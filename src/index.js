const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const { parseMessage } = require("./parser");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START");

// 🔧 нормалізація
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// 🔗 пошук каналу
function findChannel(region) {
  const normRegion = normalize(region);

  for (const [channel, aliases] of Object.entries(config.regions)) {
    for (const alias of aliases) {
      if (normRegion.includes(normalize(alias))) {
        return channel;
      }
    }
  }
  return null;
}

(async () => {
  try {
    await initDB();

    const client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      {
        connectionRetries: 5,
        useWSS: false,
        deviceModel: "Desktop",
        systemVersion: "Windows",
        appVersion: "1.0",
      }
    );

    await client.start();

    console.log("✅ Connected to Telegram!");

    await client.getDialogs();
    console.log("📡 Dialogs loaded");

    await client.invoke(new Api.updates.GetState());
    console.log("📡 Updates activated");

    // =========================
    // 🤖 BOT API (групи)
    // =========================
    const TelegramBot = require("node-telegram-bot-api");

    const bot = new TelegramBot(config.notifyBotToken);

    await bot.deleteWebHook();
    console.log("🧹 Webhook cleared");

    bot.startPolling();
    console.log("🤖 Bot polling started");

    bot.on("message", (msg) => {
      const chatTitle = msg.chat.title || "";

      console.log("🔥 ANY MESSAGE:", msg.text);
      console.log("👉 CHAT:", chatTitle);

      if (chatTitle.includes("Alerts")) {
        console.log("\n🟢 BOT API MESSAGE");
        console.log("📍 Chat:", chatTitle);
        console.log("📍 ID:", msg.chat.id);
        console.log("💬 Text:", msg.text);
      }
    });

    // =========================
    // 📊 ЗВІТИ
    // =========================
    let lastReportTime = null;

    setInterval(async () => {
      const now = new Date();

      const hours = (now.getUTCHours() + 3) % 24;
      const minutes = now.getUTCMinutes();

      if (hours === 8 && minutes === 55 && lastReportTime !== "morning") {
        console.log("📊 Ранковий звіт...");
        await generateReport();
        lastReportTime = "morning";
      }

      if (hours === 20 && minutes === 55 && lastReportTime !== "evening") {
        console.log("📊 Вечірній звіт...");
        await generateReport();
        lastReportTime = "evening";
      }

      if (hours === 0 && minutes === 0) {
        lastReportTime = null;
      }

    }, 60000);

    // =========================
    // 📡 AIR ALERT (основний канал)
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;

      if (chat.username !== config.sourceChannel) return;

      console.log("\n📡 AIR ALERT MESSAGE:");
      console.log(message);

      const parsed = parseMessage(message);

      if (!parsed) {
        console.log("⛔ Не розпарсилось");
        return;
      }

      console.log("📊 PARSED:", parsed);

      for (const region of parsed.regions) {
        const channel = findChannel(region);

        if (!channel) {
          console.log("⚠️ Не знайдено канал для:", region);
          continue;
        }

        console.log(`🎯 ${region} → ${channel}`);

        if (parsed.type === "alert") {
          startTimer(channel, "blue");
        }

        if (parsed.type === "clear") {
          startTimer(channel, "green");
        }
      }

    }, new NewMessage({}));

    // =========================
    // 📥 ПРИВАТНІ КАНАЛИ (оновлення рівнів)
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;

      const rawChannelName = chat.title;

      const matchedChannel = Object.keys(config.regions).find(
        key => normalize(key) === normalize(rawChannelName)
      );

      if (!matchedChannel) return;

      console.log(`\n📥 UPDATE FROM ${matchedChannel}:`);
      console.log(message);

      await updateLevel(matchedChannel, message);

      let level = null;

      if (message.includes("🔷")) level = "blue";
      if (message.includes("✅")) level = "green";
      if (message.includes("🟡")) level = "yellow";
      if (message.includes("🚨")) level = "red";

      if (level) {
        console.log(`📊 Рівень: ${level}`);
      }

      if (level === "blue" || level === "green") {
        cancelTimer(matchedChannel, level);
      }

    }, new NewMessage({}));

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();