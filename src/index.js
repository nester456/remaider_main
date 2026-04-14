const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Raw } = require("telegram/events");

const { parseMessage } = require("./parser");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START");

(async () => {
  try {
    await initDB();

    const client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 }
    );

    client.setLogLevel("error");

    await client.start();

    console.log("✅ Connected to Telegram!");

    await client.getDialogs();
    console.log("📡 Dialogs loaded");

    // =========================
    // 🔥 1. POLLING AIR ALERT
    // =========================
    let lastMessageId = null;

    setInterval(async () => {
      try {
        const messages = await client.getMessages(config.sourceChannel, { limit: 1 });

        if (!messages || !messages.length) return;

        const msg = messages[0];

        if (msg.id === lastMessageId) return; // ❗ не дублюємо

        lastMessageId = msg.id;

        const text = msg.message;

        console.log("\n📡 AIR ALERT POLLING:");
        console.log("💬 TEXT:", text);

        const parsed = parseMessage(text);
        if (!parsed) return;

        for (const region of parsed.regions) {
          const channel = Object.keys(config.regions).find(c =>
            config.regions[c].some(a => region.includes(a))
          );

          if (!channel) {
            console.log("⚠️ Не знайдено канал:", region);
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

      } catch (err) {
        console.log("❌ POLLING ERROR:", err.message);
      }
    }, 10000); // кожні 10 сек

    // =========================
    // 🔥 2. ALERTS GROUPS (RAW)
    // =========================
    client.addEventHandler(async (event) => {
      try {
        const update = event.originalUpdate;

        if (!update || !update._) return;

        let msg = null;

        if (update._ === "updateNewChannelMessage") {
          msg = update.message;
        }

        if (update._ === "updateNewMessage") {
          msg = update.message;
        }

        if (!msg) return;

        const text = msg.message;
        if (!text) return;

        let chatId = null;

        if (msg.peerId?.channelId) {
          chatId = msg.peerId.channelId.toString();
        }

        const channelName = config.channelIds[chatId];

        if (!channelName) return;

        console.log("\n🔥 ALERT GROUP");
        console.log("📍 CHANNEL:", channelName);
        console.log("💬 TEXT:", text);

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
    let lastReportTime = null;

    setInterval(async () => {
      const now = new Date();

      const hours = (now.getUTCHours() + 3) % 24;
      const minutes = now.getUTCMinutes();

      if (hours === 8 && minutes === 55 && lastReportTime !== "morning") {
        console.log("📊 Morning report");
        await generateReport();
        lastReportTime = "morning";
      }

      if (hours === 20 && minutes === 55 && lastReportTime !== "evening") {
        console.log("📊 Evening report");
        await generateReport();
        lastReportTime = "evening";
      }

      if (hours === 0 && minutes === 0) {
        lastReportTime = null;
      }

    }, 60000);

    // =========================
    // 🌐 KEEP ALIVE
    // =========================
    const http = require("http");

    http.createServer((req, res) => {
      res.write("Bot is running");
      res.end();
    }).listen(3000);

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();