// src/watcher.js

const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const REMINDER_MS = 60000;

// active reminder timers
const activeTimers = {};

// pending cycle states
const pending = {};

// telegram hooks from index.js
let fetchLatestLevelFn = null;

// ------------------------------------
// inject function from index.js
// ------------------------------------
function setFetchLatestLevel(fn) {
  fetchLatestLevelFn = fn;
}

// ------------------------------------
// helpers
// ------------------------------------
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🚨")) return "red";

  return null;
}

function isAlert(level) {
  return level === "blue" || level === "yellow" || level === "red";
}

function now() {
  return Date.now();
}

// ------------------------------------
// live check latest level from channel
// ------------------------------------
async function getRealLevel(channel) {
  let current = getLastLevel(channel);

  if (current !== null) return current;

  if (!fetchLatestLevelFn) return null;

  try {
    const liveText = await fetchLatestLevelFn(channel);
    const liveLevel = detectLevel(liveText);

    if (liveLevel) {
      await saveLevel(channel, liveLevel);
      return liveLevel;
    }
  } catch (err) {
    console.log("⚠️ LIVE CHECK ERROR:", channel, err.message);
  }

  return null;
}

// ------------------------------------
// save level from private channels
// ------------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  await saveLevel(channel, level);

  const p = pending[channel];
  if (!p) return;

  // waiting BLUE
  if (p.expected === "blue" && level === "blue") {
    const delay = Math.round((now() - p.startedAt) / 60000);

    await addEvent({
      channel,
      type: "blue",
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: p.startedAt
    });

    delete pending[channel];
  }

  // waiting GREEN
  if (p.expected === "green" && level === "green") {
    const delay = Math.round((now() - p.startedAt) / 60000);

    await addEvent({
      channel,
      type: "green",
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: p.startedAt,
      hadRed: p.levelAtReminder === "red",
      hadYellow: p.levelAtReminder === "yellow"
    });

    delete pending[channel];
  }
}

// ------------------------------------
// start by AIR ALERT signal
// ------------------------------------
async function startTimer(channel, expectedLevel) {
  const current = await getRealLevel(channel);

  console.log("🚀 START TIMER:", channel, expectedLevel, current);

  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel]);
    delete activeTimers[channel];
  }

  // new ALERT closes old GREEN
  if (expectedLevel === "blue") {
    const old = pending[channel];

    if (old && old.expected === "green") {
      await addEvent({
        channel,
        type: "green",
        status: "not_set",
        time: old.startedAt,
        hadRed: old.levelAtReminder === "red",
        hadYellow: old.levelAtReminder === "yellow"
      });

      delete pending[channel];
    }

    if (isAlert(current)) {
      console.log("⛔ BLUE skip live-check active");
      return;
    }

    pending[channel] = {
      expected: "blue",
      startedAt: now(),
      reminderAt: null
    };
  }

  // new CLEAR closes old BLUE
  if (expectedLevel === "green") {
    const old = pending[channel];

    if (old && old.expected === "blue") {
      await addEvent({
        channel,
        type: "blue",
        status: "not_set",
        time: old.startedAt
      });

      delete pending[channel];
    }

    if (current === "green") {
      console.log("⛔ GREEN skip live-check green");
      return;
    }

    pending[channel] = {
      expected: "green",
      startedAt: now(),
      reminderAt: null,
      levelAtReminder: null
    };
  }

  // ------------------------------------
  // reminder timer
  // ------------------------------------
  activeTimers[channel] = setTimeout(async () => {
    const p = pending[channel];
    if (!p) return;

    const latest = await getRealLevel(channel);

    // BLUE reminder
    if (p.expected === "blue") {
      if (latest !== "blue") {
        await sendMessage(
          `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
        );
      }

      p.reminderAt = now();
    }

    // GREEN reminder
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
  }, REMINDER_MS);
}

// compatibility
function cancelTimer() {
  return;
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer,
  setFetchLatestLevel
};