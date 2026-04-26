// src/watcher.js

const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const REMINDER_MS = 60000;
const FAST_SWITCH_MS = 90000;

const activeTimers = {};
const pending = {};

let fetchLatestLevelFn = null;

// ------------------------------------
// logger
// ------------------------------------
function log(...args) {
  console.log("[WATCHER]", ...args);
}

// ------------------------------------
// hooks
// ------------------------------------
function setFetchLatestLevel(fn) {
  fetchLatestLevelFn = fn;
  log("LIVE CHECK HOOK READY");
}

// ------------------------------------
// helpers
// ------------------------------------
function now() {
  return Date.now();
}

function isAlert(level) {
  return (
    level === "blue" ||
    level === "yellow" ||
    level === "red"
  );
}

function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🚨")) return "red";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";

  return null;
}

// ------------------------------------
// live check
// ------------------------------------
async function getRealLevel(channel) {
  const saved = getLastLevel(channel);

  if (saved !== null) {
    log("LIVE CHECK SKIP (cached):", channel, saved);
    return saved;
  }

  if (!fetchLatestLevelFn) {
    log("LIVE CHECK UNAVAILABLE:", channel);
    return null;
  }

  try {
    const text = await fetchLatestLevelFn(channel);
    const level = detectLevel(text);

    log("LIVE CHECK RESULT:", channel, level);

    if (level) {
      await saveLevel(channel, level);
      log("DB SAVE FROM LIVE CHECK:", channel, level);
      return level;
    }
  } catch (err) {
    log("LIVE CHECK ERROR:", err.message);
  }

  return null;
}

// ------------------------------------
// private group level update
// ------------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);

  if (!level) {
    log("LEVEL NOT DETECTED:", channel);
    return;
  }

  log("LEVEL UPDATE:", channel, level);

  await saveLevel(channel, level);
  log("DB LEVEL SAVED:", channel, level);

  const p = pending[channel];

  if (!p) {
    log("NO PENDING STATE:", channel);
    return;
  }

  log(
    "PENDING FOUND:",
    channel,
    "expected:",
    p.expected
  );

  // ---------------- BLUE CLOSED ----------------
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

    log("BLUE EVENT SAVED:", channel, delay);

    delete pending[channel];
    log("PENDING REMOVED:", channel);

    return;
  }

  // ---------------- GREEN CLOSED ----------------
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
      hadYellow:
        p.levelAtReminder === "yellow"
    });

    log("GREEN EVENT SAVED:", channel, delay);

    delete pending[channel];
    log("PENDING REMOVED:", channel);

    return;
  }

  log(
    "LEVEL DOES NOT CLOSE PENDING:",
    channel,
    level
  );
}

// ------------------------------------
// start timer from public alert
// ------------------------------------
async function startTimer(channel, expectedLevel) {
  log(
    "START TIMER REQUEST:",
    channel,
    expectedLevel
  );

  const current = await getRealLevel(channel);

  log(
    "CURRENT LEVEL:",
    channel,
    current
  );

  // remove old timer
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel]);
    delete activeTimers[channel];

    log("OLD TIMER CLEARED:", channel);
  }

  // ==================================
  // BLUE
  // ==================================
  if (expectedLevel === "blue") {
    const old = pending[channel];

    if (old && old.expected === "green") {
      const age = now() - old.startedAt;

      log(
        "OLD GREEN PENDING FOUND:",
        channel,
        "age:",
        age
      );

      if (
        age >= FAST_SWITCH_MS &&
        old.reminderAt
      ) {
        await addEvent({
          channel,
          type: "green",
          status: "not_set",
          time: old.startedAt,
          hadRed:
            old.levelAtReminder === "red",
          hadYellow:
            old.levelAtReminder ===
            "yellow"
        });

        log(
          "GREEN NOT_SET SAVED:",
          channel
        );
      } else {
        log(
          "FAST SWITCH GREEN IGNORED:",
          channel
        );
      }

      delete pending[channel];
      log("OLD GREEN REMOVED:", channel);
    }

    if (isAlert(current)) {
      log(
        "SKIP BLUE TIMER ACTIVE ALERT:",
        channel
      );
      return;
    }

    pending[channel] = {
      expected: "blue",
      startedAt: now(),
      reminderAt: null
    };

    log("NEW BLUE PENDING:", channel);
  }

  // ==================================
  // GREEN
  // ==================================
  if (expectedLevel === "green") {
    const old = pending[channel];

    if (old && old.expected === "blue") {
      const age = now() - old.startedAt;

      log(
        "OLD BLUE PENDING FOUND:",
        channel,
        "age:",
        age
      );

      if (
        age >= FAST_SWITCH_MS &&
        old.reminderAt
      ) {
        await addEvent({
          channel,
          type: "blue",
          status: "not_set",
          time: old.startedAt
        });

        log(
          "BLUE NOT_SET SAVED:",
          channel
        );
      } else {
        log(
          "FAST SWITCH BLUE IGNORED:",
          channel
        );
      }

      delete pending[channel];
      log("OLD BLUE REMOVED:", channel);
    }

    if (current === "green") {
      log(
        "SKIP GREEN TIMER ALREADY GREEN:",
        channel
      );
      return;
    }

    pending[channel] = {
      expected: "green",
      startedAt: now(),
      reminderAt: null,
      levelAtReminder: null
    };

    log("NEW GREEN PENDING:", channel);
  }

  // ==================================
  // reminder timer
  // ==================================
  activeTimers[channel] = setTimeout(
    async () => {
      const p = pending[channel];

      if (!p) {
        log(
          "TIMER FIRED BUT NO PENDING:",
          channel
        );
        return;
      }

      const latest =
        await getRealLevel(channel);

      log(
        "TIMER FIRED:",
        channel,
        "expected:",
        p.expected,
        "latest:",
        latest
      );

      // blue
      if (p.expected === "blue") {
        if (latest !== "blue") {
          await sendMessage(
            `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
          );

          log(
            "BLUE REMINDER SENT:",
            channel
          );
        }

        p.reminderAt = now();
      }

      // green
      if (p.expected === "green") {
        if (latest !== "green") {
          await sendMessage(
            `❗❗❗ Увага, ви не поставили ✅ *зелений* рівень тривоги в ${channel}`
          );

          log(
            "GREEN REMINDER SENT:",
            channel
          );
        }

        p.reminderAt = now();
        p.levelAtReminder = latest;
      }

      delete activeTimers[channel];
      log("TIMER REMOVED:", channel);
    },
    REMINDER_MS
  );

  log("NEW TIMER CREATED:", channel);
}

// compatibility
function cancelTimer(channel, level) {
  log(
    "CANCEL TIMER REQUEST:",
    channel,
    level
  );

  return;
}

module.exports = {
  startTimer,
  updateLevel,
  cancelTimer,
  setFetchLatestLevel
};