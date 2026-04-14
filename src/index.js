const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
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
    // 🔥 RAW HANDLER (ФІНАЛЬНИЙ)
    // =========================
    client.addEventHandler(async (event) => {
      try {
        console.log("\n⚡ EVENT RECEIVED");

        const message = event.message;
        if (!message) return;

        const text = message.message;

        console.log("💬 TEXT:", text);

        // 🔥 пробуємо отримати chat різними способами
        let chatTitle = null;

        if (message.peerId?.channelId) {
          chatTitle = message.peerId.channelId.toString();
        }

        if (!chatTitle && event.chat) {
          chatTitle = event.chat.title;
        }

        console.log("📍 CHAT:", chatTitle);

        // =========================
        // 🔧 ЛОГІКА РІВНІВ
        // =========================

        if (!text) return;

        // поки працюємо по тексту (без прив'язки до чату)
        await updateLevel(chatTitle || "unknown", text);

        let level = null;

        if (text.includes("🔷")) level = "blue";
        if (text.includes("✅")) level = "green";

        if (level) {
          cancelTimer(chatTitle || "unknown", level);
        }

      } catch (err) {
        console.log("❌ ERROR:", err.message);
      }
    });

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