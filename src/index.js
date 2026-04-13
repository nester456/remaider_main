const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START");

// 🔍 Парсинг повідомлення
function parseMessage(text) {
  if (!text) return null;

  let type = null;

  if (text.includes("Повітряна тривога")) {
    type = "alert";
  }

  if (text.includes("Відбій")) {
    type = "clear";
  }

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

// 🔗 район → канал
function findChannel(region) {
  for (const [channel, aliases] of Object.entries(config.regions)) {
    if (aliases.includes(region)) {
      return channel;
    }
  }
  return null;
}

(async () => {
  try {
    // ✅ база
    await initDB();

    const client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 }
    );

    await client.start();

    console.log("✅ Connected to Telegram!");

    // =========================
    // 📊 ЗВІТ ПО ЗМІНІ
    // =========================
    let reportSent = false;

    const dayjs = require("dayjs");

let lastReportTime = null;

setInterval(async () => {
  const now = dayjs().utcOffset(3);

  const hours = now.hour();
  const minutes = now.minute();

  const currentTime = `${hours}:${minutes}`;

  // 🕗 08:55
  if (hours === 8 && minutes === 55 && lastReportTime !== "morning") {
    console.log("📊 Ранковий звіт...");
    await generateReport();
    lastReportTime = "morning";
  }

  // 🕗 20:55
  if (hours === 20 && minutes === 55 && lastReportTime !== "evening") {
    console.log("📊 Вечірній звіт...");
    await generateReport();
    lastReportTime = "evening";
  }

  // 🔄 скидання (щоб на наступний день знову працювало)
  if (hours === 0 && minutes === 0) {
    lastReportTime = null;
  }

}, 60000);

    // =========================
    // 📡 AIR ALERT
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;

      if (chat.username !== config.sourceChannel) return;

      console.log("\n📡 AIR ALERT MESSAGE:");
      console.log(message);

      const parsed = parseMessage(message);
      if (!parsed) return;

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
    // 📥 ПРИВАТНІ КАНАЛИ
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;

      const channelName = chat.title;

      if (!config.regions[channelName]) return;

      console.log(`\n📥 UPDATE FROM ${channelName}:`);
      console.log(message);

      // оновлюємо рівень
      await updateLevel(channelName, message);

     let level = null;

if (message.includes("🔷")) level = "blue";
if (message.includes("✅")) level = "green";
if (message.includes("🟡")) level = "yellow";
if (message.includes("🚨")) level = "red";

if (level) {
  console.log(`📊 Рівень: ${level}`);
}

      if (level) {
        cancelTimer(channelName, level);
      }

    }, new NewMessage({}));

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();