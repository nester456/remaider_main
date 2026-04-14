const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Raw } = require("telegram/events");

const config = require("./config");
const { updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");

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

    client.setLogLevel("debug");

    await client.start();

    console.log("✅ Connected to Telegram!");

    await client.getDialogs();
    console.log("📡 Dialogs loaded");

    await client.invoke(new Api.updates.GetState());
    console.log("📡 Updates activated");

    // =========================
    // 🔥 RAW EVENT HANDLER
    // =========================
    client.addEventHandler(async (event) => {
      try {
        console.log("\n🔥 RAW EVENT CAUGHT");
        console.log("TYPE:", event.className);

        const msg = event.message;
        if (!msg) return;

        const text = msg.message;
        if (!text) return;

        console.log("💬 TEXT:", text);

        let chatId = null;

        if (msg.peerId?.channelId) {
          chatId = msg.peerId.channelId.toString();
        }

        console.log("📍 CHAT ID:", chatId);

        const channelName = config.channelIds[chatId];

        if (!channelName) {
          console.log("⚠️ Unknown channel:", chatId);
          return;
        }

        console.log("✅ CHANNEL:", channelName);

        // 🔧 логіка рівнів
        await updateLevel(channelName, text);

        let level = null;

        if (text.includes("🔷")) level = "blue";
        if (text.includes("✅")) level = "green";

        if (level) {
          cancelTimer(channelName, level);
        }

      } catch (err) {
        console.log("❌ RAW ERROR:", err.message);
      }
    }, new Raw({}));

    // =========================
    // 🌐 KEEP ALIVE (Railway)
    // =========================
    const http = require("http");

    http.createServer((req, res) => {
      res.write("Bot is running");
      res.end();
    }).listen(3000, () => {
      console.log("🌐 HTTP server running");
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();