// src/index.js

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const config = require("./config");

const {
  startTimer,
  updateLevel,
  cancelTimer,
  setFetchLatestLevel
} = require("./watcher");

const { initDB } = require("./storage");
const { generateReport } = require("./report");

console.log("🚀 START FILE");

// ------------------------------------
// normalize
// ------------------------------------
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------
// level detect with priority
// ------------------------------------
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🚨")) return "red";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";

  return null;
}

// ------------------------------------
// main
// ------------------------------------
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

    // ------------------------------------
    // watcher live-check hook
    // ------------------------------------
    setFetchLatestLevel(async (channelName) => {
      const chatId = Object.keys(config.channelIds).find(
        (id) => config.channelIds[id] === channelName
      );

      if (!chatId) {
        console.log("⚠️ LIVE CHECK NO CHAT:", channelName);
        return null;
      }

      try {
        const msgs = await client.getMessages(chatId, {
          limit: 1
        });

        if (!msgs.length) {
          console.log("⚠️ LIVE CHECK EMPTY:", channelName);
          return null;
        }

        const text = msgs[0].message || "";

        console.log(
          "🔍 LIVE CHECK:",
          channelName,
          "→",
          text.replace(/\n/g, " ").slice(0, 80)
        );

        return text;
      } catch (err) {
        console.log(
          "⚠️ LIVE FETCH ERROR:",
          channelName,
          err.message
        );

        return null;
      }
    });

    const me = await client.getMe();

    console.log(
      "👤 LOGGED AS:",
      me.username || me.firstName,
      me.id
    );

    // ------------------------------------
    // init source pointer
    // ------------------------------------
    let lastMessageId = 0;

    const init = await client.getMessages(
      config.sourceChannel,
      { limit: 1 }
    );

    if (init.length > 0) {
      lastMessageId = init[0].id;
      console.log("🔐 INITIALIZED AT:", lastMessageId);
    }

    // ------------------------------------
    // dialogs
    // ------------------------------------
    const dialogs = await client.getDialogs();

    console.log("📚 ALL DIALOGS:");

    dialogs.forEach((d) => {
      console.log(
        "TITLE:",
        d.title,
        "| ID:",
        d.id?.toString?.() || d.id
      );
    });

    // ====================================
    // PUBLIC ALERT SOURCE POLLING
    // ====================================
    setInterval(async () => {
      try {
        const messages = await client.getMessages(
          config.sourceChannel,
          { limit: 10 }
        );

        if (!messages?.length) return;

        const sorted = messages.sort(
          (a, b) => a.id - b.id
        );

        for (const msg of sorted) {
          if (!msg.message) continue;
          if (msg.id <= lastMessageId) continue;

          lastMessageId = msg.id;

          const text = msg.message;
          const textNorm = normalize(text);

          console.log("\n📡 AIR ALERT:");
          console.log("💬 TEXT:", text);

          const matched = new Set();

          for (const [channel, keywords] of Object.entries(
            config.regions
          )) {
            if (matched.has(channel)) continue;

            const hit = keywords.some((keyword) =>
              textNorm.includes(normalize(keyword))
            );

            if (!hit) continue;

            matched.add(channel);

            // alert
            if (textNorm.includes("повітряна тривога")) {
              console.log("🎯 ALERT →", channel);

              await startTimer(channel, "blue");

              console.log(
                "📝 START TIMER REQUEST SAVED:",
                channel,
                "blue"
              );
            }

            // clear
            if (
              textNorm.includes("відбій") &&
              textNorm.includes("тривог")
            ) {
              console.log("🎯 CLEAR →", channel);

              await startTimer(channel, "green");

              console.log(
                "📝 START TIMER REQUEST SAVED:",
                channel,
                "green"
              );
            }
          }
        }
      } catch (err) {
        console.log("❌ POLLING ERROR:", err.message);
      }
    }, 10000);

    // ====================================
    // PRIVATE CHANNELS
    // ====================================
    client.addEventHandler(
      async (event) => {
        try {
          const msg = event.message;
          if (!msg?.message) return;

          const text = msg.message;

          let chatId = null;

          if (msg.peerId?.channelId) {
            chatId = msg.peerId.channelId.toString();
          }

          if (msg.peerId?.chatId) {
            chatId = msg.peerId.chatId.toString();
          }

          console.log("\n📩 NEW GROUP MESSAGE");
          console.log("📩 CHAT ID:", chatId);
          console.log("💬 TEXT:", text);

          const channelName =
            config.channelIds[chatId];

          if (!channelName) {
            console.log("⚠️ UNKNOWN CHANNEL");
            return;
          }

          console.log(
            "🎯 MATCHED CHANNEL:",
            channelName
          );

          // save level in DB
          await updateLevel(channelName, text);

          console.log(
            "📝 LEVEL UPDATE SAVED:",
            channelName
          );

          // detect level
          const level = detectLevel(text);

          console.log(
            "📊 DETECTED LEVEL:",
            level
          );

          // cancel active timer
          if (level) {
            console.log(
              "🛑 CANCEL REQUEST:",
              channelName,
              level
            );

            cancelTimer(channelName, level);

            console.log(
              "📝 CANCEL REQUEST DONE:",
              channelName,
              level
            );
          }
        } catch (err) {
          console.log(
            "❌ GROUP HANDLER ERROR:",
            err.message
          );
        }
      },
      new NewMessage({})
    );

    // ====================================
    // REPORTS
    // ====================================
    setInterval(async () => {
      try {
        const now = new Date();

        const kyivHour =
          (now.getUTCHours() + 3) % 24;

        const min = now.getUTCMinutes();

        if (
          (kyivHour === 8 ||
            kyivHour === 20) &&
          min === 55
        ) {
          console.log("📊 GENERATE REPORT");

          await generateReport();

          console.log("📝 REPORT SENT");
        }
      } catch (err) {
        console.log("❌ REPORT ERROR:", err.message);
      }
    }, 60000);

  } catch (err) {
    console.log("❌ GLOBAL ERROR:", err);
  }
})();