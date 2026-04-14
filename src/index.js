const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START");

// 🔧 нормалізація тексту
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// 🔍 Парсинг повідомлення
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

// 🔗 район → канал (розумний пошук)
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
      { connectionRetries: 5 }
    );

    await client.start();

    console.log("✅ Connected to Telegram!");

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

      const rawChannelName = chat.title;
      const normChannel = normalize(rawChannelName);

      console.log("DEBUG CHANNEL:", rawChannelName);

      const matchedChannel = Object.keys(config.regions).find(
        key => normalize(key) === normChannel
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
      } else {
        console.log("⚠️ Не розпізнано рівень:", message);
      }

      if (level === "blue" || level === "green") {
        cancelTimer(matchedChannel, level);
      }

    }, new NewMessage({}));

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();