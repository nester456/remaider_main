// src/watcher.js

const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const REMINDER_MS = 60000;

const activeTimers = {};
const pending = {};

let fetchLatestLevelFn = null;

// ------------------------------------
// external hook from index.js
// ------------------------------------
function setFetchLatestLevel(fn) {
  fetchLatestLevelFn = fn;
}

// ------------------------------------
// helpers
// ------------------------------------
function now() {
  return Date.now();
}

function isAlert(level) {
  return level === "blue" || level === "yellow" || level === "red";
}

// IMPORTANT: priority order
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🚨")) return "red";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";

  return null;
}

// ------------------------------------
// live read last message from channel
// ------------------------------------
async function getRealLevel(channel) {
  const saved = getLastLevel(channel);

  if (saved !== null) return saved;

  if (!fetchLatestLevelFn) return null;

  try {
    const text = await fetchLatestLevelFn(channel);
    const level = detectLevel(text);

    if (level) {
      await saveLevel(channel, level);
      return level;
    }
  } catch (err) {
    console.log("⚠️ LIVE CHECK ERROR:", err.message);
  }

  return null;
}

// ------------------------------------
// private channel update
// ------------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  console.log("💾 SAVE LEVEL:", channel, level);

  await saveLevel(channel, level);

  const p = pending[channel];
  if (!p) return;

  // waiting blue
  if (p.expected === "blue" && level === "blue") {
    const delay = Math.round(
      (now() - p.startedAt) / 60000
    );

    await addEvent({
      channel,
      type: "blue",
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: p.startedAt
    });

    console.log("✅ BLUE CLOSED:", channel, delay);

    delete pending[channel];
  }

  // waiting green
  if (p.expected === "green" && level === "green") {
    const delay = Math.round(
      (now() - p.startedAt) / 60000
    );

    await addEvent({
      channel,
      type: "green",
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: p.startedAt,
      hadRed: p.levelAtReminder === "red",
      hadYellow: p.levelAtReminder === "yellow"
    });

    console.log("✅ GREEN CLOSED:", channel, delay);

    delete pending[channel];
  }
}

// ------------------------------------
// start from public alert feed
// ------------------------------------
async function startTimer(channel, expectedLevel) {
  const current = await getRealLevel(channel);

  console.log(
    "🚀 START TIMER:",
    channel,
    expectedLevel,
    current
  );

  // remove previous timer
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel]);
    delete activeTimers[channel];
  }

  // ==================================
  // BLUE request
  // ==================================
  if (expectedLevel === "blue") {
    const old = pending[channel];

    // close old green cycle
    if (old && old.expected === "green") {
      await addEvent({
        channel,
        type: "green",
        status: "not_set",
        time: old.startedAt,
        hadRed: old.levelAtReminder === "red",
        hadYellow:
          old.levelAtReminder === "yellow"
      });

      delete pending[channel];
    }

    // already alert locally
    if (isAlert(current)) {
      console.log(
        "⛔ BLUE skip active level"
      );
      return;
    }

    pending[channel] = {
      expected: "blue",
      startedAt: now(),
      reminderAt: null
    };
  }

  // ==================================
  // GREEN request
  // ==================================
  if (expectedLevel === "green") {
    const old = pending[channel];

    // close old blue cycle
    if (old && old.expected === "blue") {
      await addEvent({
        channel,
        type: "blue",
        status: "not_set",
        time: old.startedAt
      });

      delete pending[channel];
    }

    // already green locally
    if (current === "green") {
      console.log(
        "⛔ GREEN skip already green"
      );
      return;
    }

    pending[channel] = {
      expected: "green",
      startedAt: now(),
      reminderAt: null,
      levelAtReminder: null
    };
  }

  // ==================================
  // reminder after 60 sec
  // ==================================
  activeTimers[channel] = setTimeout(
    async () => {
      const p = pending[channel];
      if (!p) return;

      const latest =
        await getRealLevel(channel);

      // blue reminder
      if (p.expected === "blue") {
        if (latest !== "blue") {
          await sendMessage(
            `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
          );
        }

        p.reminderAt = now();
      }

      // green reminder
      if (p.expected === "green") {
        if (latest !== "green") {
          await sendMessage(
            `❗❗❗ Увага, ви не поставили ✅ *зелений* рівень тривоги в ${channel}`
          );
        }

        p.reminderAt = now();
        p.levelAtReminder = latest;
      }

      delete activeTimers[channel];
    },
    REMINDER_MS
  );
}

// compatibility
function cancelTimer() {
  return;
}

module.exports = {
  startTimer,
  updateLevel,
  cancelTimer,
  setFetchLatestLevel
};