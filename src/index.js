const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

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

// 🔍 парсинг
function parseMessage(text) {
  if (!text) return null;

  let type = null;

  if (text.includes("Повітряна тривога")) type = "alert";
  if (text.includes("Відбій")) type = "clear";

  if (!type) return null;

  const lines = text.split("\n");

  const regions = lines
    .map(l => l.replace("•", "").trim())
    .filter(l =>
      l &&
      !l.includes("Повітряна") &&
      !l.includes("Відбій")
    );

  return { type, regions };
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

    // 🔥 КРИТИЧНО
    await client.getDialogs();
    console.log("📡 Dialogs loaded");

    await client.invoke(new Api.updates.GetState());
    console.log("📡 Updates activated");
    // =========================
// 🤖 BOT API (для Alerts груп)
// =========================
// =========================
// 🤖 BOT API (для Alerts груп)
// =========================
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(config.notifyBotToken);

// очищаємо webhook
await bot.deleteWebHook();
console.log("🧹 Webhook cleared");

bot.startPolling();
console.log("🤖 Bot polling started");
// =========================
// 🔍 ПЕРЕВІРКА ЧАТІВ БОТА
// =========================
setTimeout(async () => {
  try {
    const updates = await bot.getUpdates();

    console.log("\n📡 UPDATES DEBUG:");

    updates.forEach((u) => {
      if (u.message) {
        console.log("👉 CHAT TITLE:", u.message.chat.title);
        console.log("👉 CHAT ID:", u.message.chat.id);
        console.log("👉 TEXT:", u.message.text);
        console.log("------------------------");
      }
    });

  } catch (err) {
    console.log("❌ getUpdates error:", err.message);
  }
}, 10000);

// 🔥 ЄДИНИЙ handler
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
    // 📨 ГЛОБАЛЬНИЙ ЛОГ
    // =========================
   client.addEventHandler(async (event) => {
  const message = event.message.message;
  const chat = await event.getChat();

  if (!message || !chat) return;

  const title = chat.title || "";

  // 🔥 ЛОВИМО ВСІ ALERTS ГРУПИ
  if (title.includes("Alerts")) {
    console.log("\n🟢 ALERTS GROUP MESSAGE DETECTED");
    console.log("📍 Title:", title);
    console.log("📍 Username:", chat.username);
    console.log("📍 ID:", chat.id);
    console.log("💬 Text:", message);
  }

}, new NewMessage({}));

    // =========================
    // 📡 AIR ALERT
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;

      if (chat.username !== config.sourceChannel) {
        return;
      }

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
          console.log("⏱ Старт таймера BLUE");
          startTimer(channel, "blue");
        }

        if (parsed.type === "clear") {
          console.log("⏱ Старт таймера GREEN");
          startTimer(channel, "green");
        }
      }

    }, new NewMessage({}));

    // =========================
    // 📥 ПРИВАТНІ КАНАЛИ
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
        console.log("🛑 Скасування таймера");
        cancelTimer(matchedChannel, level);
      }

    }, new NewMessage({}));

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();