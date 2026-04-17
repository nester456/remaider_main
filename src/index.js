const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Raw } = require("telegram/events");

const { parseMessage, normalize } = require("./parser");

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

    await client.start();
    console.log("✅ Connected to Telegram!");

    await client.getDialogs();

    // =========================
    // 🔥 AIR ALERT (POLLING)
    // =========================
    let lastMessageId = null;

    setInterval(async () => {
      try {
        const messages = await client.getMessages(config.sourceChannel, { limit: 1 });
        if (!messages?.length) return;

        const msg = messages[0];

        if (msg.id === lastMessageId) return;
        lastMessageId = msg.id;

        const text = msg.message;

        console.log("\n📡 AIR ALERT:", text);

        const parsed = parseMessage(text);
        if (!parsed) return;

        for (const region of parsed.regions) {
          const regionNorm = normalize(region);

          const channel = Object.keys(config.regions).find(c =>
            config.regions[c].some(a =>
              regionNorm.includes(normalize(a))
            )
          );

          if (!channel) {
            console.log("⚠️ Не знайдено:", region);
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
    }, 10000);

    // =========================
    // 🔥 ALERT GROUPS
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