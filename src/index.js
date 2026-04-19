const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const config = require("./config");
const { startTimer, updateLevel, cancelTimer } = require("./watcher");
const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START FILE");

// 🔹 normalize
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
    console.log("🔧 INIT DB...");
    await initDB();

    const client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 }
    );

    console.log("🔌 BEFORE CONNECT...");
    await client.connect();

    console.log("✅ CONNECTED TO TELEGRAM");

    const me = await client.getMe();
    console.log("👤 LOGGED AS:", me.username || me.firstName, me.id);

    // 🔐 INIT
    let lastMessageId = 0;

    const init = await client.getMessages(config.sourceChannel, { limit: 1 });

    if (init.length > 0) {
      lastMessageId = init[0].id;
      console.log("🔐 INITIALIZED AT:", lastMessageId);
    }

    // 🔍 dialogs
    const dialogs = await client.getDialogs();

    console.log("📚 ALL DIALOGS:");

    dialogs.forEach((d) => {
      console.log("TITLE:", d.title, "| ID:", d.id?.toString?.() || d.id);
    });

    // =========================
    // 🔥 AIR ALERT POLLING
    // =========================
    setInterval(async () => {
      try {
        const messages = await client.getMessages(config.sourceChannel, {
          limit: 10
        });

        if (!messages?.length) return;

        const sorted = messages.sort((a, b) => a.id - b.id);

        for (const msg of sorted) {
          if (!msg.message) continue;
          if (msg.id <= lastMessageId) continue;

          lastMessageId = msg.id;

          const text = msg.message;
          const textNorm = normalize(text);

          console.log("\n📡 AIR ALERT:");
          console.log("💬 TEXT:", text);

          const matched = new Set();

          for (const [channel, keywords] of Object.entries(config.regions)) {
            if (matched.has(channel)) continue;

            const hit = keywords.some((keyword) =>
              textNorm.includes(normalize(keyword))
            );

            if (!hit) continue;

            matched.add(channel);

            // 🔴 ALERT
            if (textNorm.includes("повітряна тривога")) {
              console.log(`🎯 ALERT → ${channel}`);
              startTimer(channel, "blue");
            }

            // 🟢 CLEAR
            if (
              textNorm.includes("відбій") &&
              textNorm.includes("тривог")
            ) {
              console.log(`🎯 CLEAR → ${channel}`);
              startTimer(channel, "green");
            }
          }
        }
      } catch (err) {
        console.log("❌ POLLING ERROR:", err.message);
      }
    }, 10000);

    // =========================
    // 🔥 PRIVATE CHANNELS / GROUPS
    // =========================
    client.addEventHandler(async (event) => {
      try {
        const msg = event.message;
        if (!msg) return;

        const text = msg.message;
        if (!text) return;

        let chatId = null;

        if (msg.peerId?.channelId) {
          chatId = "-100" + msg.peerId.channelId.toString();
        }

        if (msg.peerId?.chatId) {
          chatId = msg.peerId.chatId.toString();
        }

        console.log("\n📩 NEW GROUP MESSAGE");
        console.log("📩 CHAT ID:", chatId);
        console.log("💬 TEXT:", text);

        const channelName = config.channelIds[chatId];

        if (!channelName) {
          console.log("⚠️ UNKNOWN CHANNEL");
          return;
        }

        console.log("🎯 MATCHED CHANNEL:", channelName);

        await updateLevel(channelName, text);

        let level = null;

        if (text.includes("🔷")) level = "blue";
        if (text.includes("✅")) level = "green";
        if (text.includes("🟡")) level = "yellow";
        if (text.includes("🚨")) level = "red";

        console.log("📊 DETECTED LEVEL:", level);

        if (level === "blue" || level === "green") {
          cancelTimer(channelName, level);
        }
      } catch (err) {
        console.log("❌ GROUP HANDLER ERROR:", err.message);
      }
    }, new NewMessage({}));

    // =========================
    // 📊 REPORTS
    // =========================
    setInterval(async () => {
      const now = new Date();

      const hours = (now.getUTCHours() + 3) % 24;
      const minutes = now.getUTCMinutes();

      if ((hours === 8 || hours === 20) && minutes === 55) {
        console.log("📊 GENERATE REPORT");
        await generateReport();
      }
    }, 60000);

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
})();