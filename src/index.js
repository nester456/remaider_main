const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const { parseMessage } = require("./parser");

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

    await client.start();
    console.log("✅ Connected to Telegram!");

    await client.getDialogs();
    console.log("📡 Dialogs loaded");

    await client.invoke(new Api.updates.GetState());
    console.log("📡 Updates activated");

    // =========================
    // 🤖 BOT API
    // =========================
    const TelegramBot = require("node-telegram-bot-api");

    const bot = new TelegramBot(config.notifyBotToken);

    await bot.deleteWebHook();
    bot.startPolling();

    console.log("🤖 Bot polling started");

    bot.on("message", async (msg) => {
      const text = msg.text || "";
      const chatTitle = msg.chat.title || "";

      console.log("🔥 MESSAGE:", text);
      console.log("👉 CHAT:", chatTitle);

      if (!chatTitle.includes("Alerts")) return;

      await updateLevel(chatTitle, text);

      let level = null;
      if (text.includes("🔷")) level = "blue";
      if (text.includes("✅")) level = "green";

      if (level) {
        cancelTimer(chatTitle, level);
      }
    });

    // =========================
    // 📡 AIR ALERT
    // =========================
    client.addEventHandler(async (event) => {
      const message = event.message.message;
      const chat = await event.getChat();

      if (!message || !chat) return;
      if (chat.username !== config.sourceChannel) return;

      console.log("\n📡 AIR ALERT:", message);

      const parsed = parseMessage(message);
      if (!parsed) return;

      for (const region of parsed.regions) {
        const channel = Object.keys(config.regions).find(c =>
          config.regions[c].some(a => region.includes(a))
        );

        if (!channel) continue;

        if (parsed.type === "alert") {
          startTimer(channel, "blue");
        }

        if (parsed.type === "clear") {
          startTimer(channel, "green");
        }
      }

    }, new NewMessage({}));

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
})();

const http = require("http");

http.createServer((req, res) => {
  res.write("Bot is running");
  res.end();
}).listen(3000, () => {
  console.log("🌐 HTTP server running");
});