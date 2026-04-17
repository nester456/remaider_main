const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Raw } = require("telegram/events");

const { detectType } = require("./parser");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START");

// 🔥 нормалізація
const normalize = (str) =>
  str
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
    await client.getDialogs();

    // =========================
    // 🔥 AIR ALERT (ПРАВИЛЬНИЙ POLLING)
    // =========================
    let lastMessageId = 0;

    setInterval(async () => {
      try {
        const messages = await client.getMessages(config.sourceChannel, { limit: 10 });

        if (!messages?.length) return;

        // від старих до нових
        const sorted = messages.sort((a, b) => a.id - b.id);

        for (const msg of sorted) {
          if (!msg.message) continue;

          // ❗ пропускаємо вже оброблені
          if (msg.id <= lastMessageId) continue;

          lastMessageId = msg.id;

          const text = msg.message;

          console.log("\n📡 AIR ALERT:", text);

          const type = detectType(text);
          if (!type) continue;

          const textNorm = normalize(text);

          for (const [channel, keywords] of Object.entries(config.regions)) {
            const matchedKeyword = keywords.find(keyword =>
              textNorm.includes(normalize(keyword))
            );

            if (!matchedKeyword) continue;

            console.log(`🎯 ${matchedKeyword} → ${channel}`);

            if (type === "alert") {
              startTimer(channel, "blue");
            }

            if (type === "clear") {
              startTimer(channel, "green");
            }
          }
        }

      } catch (err) {
        console.log("❌ POLLING ERROR:", err.message);
      }
    }, 10000);

    // =========================
    // 🔥 ALERT GROUPS (приватні канали)
    // =========================
    client.addEventHandler(async (event) => {
      try {
        const update = event.originalUpdate;
        if (!update || !update._) return;

        let msg = null;

        if (update._ === "updateNewChannelMessage") msg = update.message;
        if (update._ === "updateNewMessage") msg = update.message;

        if (!msg) return;

        const text = msg.message;
        if (!text) return;

        const chatId = msg.peerId?.channelId?.toString();
        const channelName = config.channelIds[chatId];

        if (!channelName) return;

        console.log(`🔥 ${channelName}: ${text}`);

        await updateLevel(channelName, text);

        let level = null;

        if (text.includes("🔷")) level = "blue";
        if (text.includes("✅")) level = "green";
        if (text.includes("🟡")) level = "yellow";
        if (text.includes("🚨")) level = "red";

        if (level === "blue" || level === "green") {
          cancelTimer(channelName, level);
        }

      } catch (err) {
        console.log("❌ ERROR:", err.message);
      }
    }, new Raw({}));

    // =========================
    // 📊 REPORTS
    // =========================
    setInterval(async () => {
      const now = new Date();
      const hours = (now.getUTCHours() + 3) % 24;
      const minutes = now.getUTCMinutes();

      if ((hours === 8 || hours === 20) && minutes === 55) {
        await generateReport();
      }

    }, 60000);

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();