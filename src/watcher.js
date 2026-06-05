
const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const REMINDER_MS = 60000;
const FAST_SWITCH_MS = 90000;

const activeTimers = {};
const pending = {};

global.pending = pending;

let fetchLatestLevelFn = null;

// ------------------------------------
function log(...args) {
  console.log("[WATCHER]", ...args);
}

function setFetchLatestLevel(fn) {
  fetchLatestLevelFn = fn;
  log("LIVE CHECK HOOK READY");
}

function now() {
  return Date.now();
}

function isAlert(level) {
  return level === "blue" || level === "yellow" || level === "red";
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
// LIVE CHECK
// ------------------------------------
async function getRealLevel(channel) {

  if (fetchLatestLevelFn) {
    try {
      const text = await fetchLatestLevelFn(channel);
      const level = detectLevel(text);

      if (level) {
        await saveLevel(channel, level);
        log("LIVE CHECK REAL:", channel, level);
        return level;
      }
    } catch (err) {
      log("LIVE ERROR:", err.message);
    }
  }

  const saved = getLastLevel(channel);

  if (saved !== null) {
    log("LIVE CHECK CACHE FALLBACK:", channel, saved);
    return saved;
  }

  return null;
}

// ------------------------------------
// LEVEL UPDATE
// ------------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  await saveLevel(channel, level);

  log("LEVEL UPDATE:", channel, level);

  const p = pending[channel];

  if (!p) {
    log("NO PENDING:", channel);
    return;
  }

// reminder ще не було
if (!p.reminderAt) {

  if (
    (p.expected === "blue" && level === "blue") ||
    (p.expected === "green" && level === "green")
  ) {

    log("LEVEL SET BEFORE REMINDER:", channel);

    delete pending[channel];

    if (activeTimers[channel]) {
      clearTimeout(activeTimers[channel]);
      delete activeTimers[channel];
    }

    return;
  }

  log("NO REMINDER → WAIT:", channel);
  return;
}

  // ------------------------------------
  // BLUE
  // ------------------------------------
  if (p.expected === "blue" && level === "blue") {
    let delay = Math.round((now() - p.reminderAt) / 60000);

    if (delay === 0) delay = 1;

    await addEvent({
      channel,
      type: "blue",
      time: p.startedAt,
      status: "late",
      delay
    });

    log("BLUE RESOLVED:", channel, delay);

    delete pending[channel];
    return;
  }

  // ------------------------------------
  // GREEN
  // ------------------------------------
  if (p.expected === "green" && level === "green") {
    let delay = Math.round((now() - p.reminderAt) / 60000);

    if (delay === 0) delay = 1;

    await addEvent({
      channel,
      type: "green",
      time: p.startedAt,
      status: "late",
      delay,
      hadRed: p.levelAtReminder === "red",
      hadYellow: p.levelAtReminder === "yellow"
    });

    log("GREEN RESOLVED:", channel, delay);

    delete pending[channel];
    return;
  }
}

// ------------------------------------
// START TIMER
// ------------------------------------
async function startTimer(channel, expectedLevel) {
  log("START TIMER:", channel, expectedLevel);

  // ❗ якщо вже є активний pending —
  // закриваємо його як not_set
  if (pending[channel]) {
    const old = pending[channel];

    if (old.reminderAt) {
      await addEvent({
        channel,
        type: old.expected,
        time: old.startedAt,
        status: "not_set",
        hadRed: old.levelAtReminder === "red",
        hadYellow: old.levelAtReminder === "yellow"
      });

      log("OLD PENDING CLOSED AS NOT_SET:", channel);
    } else {
      log("OLD PENDING WITHOUT REMINDER:", channel);
    }

    delete pending[channel];
  }

  const current = await getRealLevel(channel);

  // очистка старого timer
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel]);
    delete activeTimers[channel];
  }

  // ------------------------------------
  // FAST SWITCH
  // ------------------------------------
  const old = pending[channel];

  if (old) {
    const age = now() - old.startedAt;

    if (age < FAST_SWITCH_MS) {
      log("FAST SWITCH:", channel);

      if (old.reminderAt) {
        await addEvent({
          channel,
          type: old.expected,
          time: old.startedAt,
          status: "not_set",
          hadRed: old.levelAtReminder === "red",
          hadYellow: old.levelAtReminder === "yellow"
        });

        log("FAST SWITCH → SAVE NOT_SET:", channel);
      } else {
        log("FAST SWITCH WITHOUT REMINDER:", channel);
      }

      delete pending[channel];
    }
  }

  // ------------------------------------
  // SKIP LOGIC
  // ------------------------------------

  // BLUE
  if (expectedLevel === "blue" && isAlert(current)) {
    log("SKIP BLUE:", channel, current);
    return;
  }

  // GREEN
  if (expectedLevel === "green" && current === "green") {
    log("SKIP GREEN:", channel);
    return;
  }

  pending[channel] = {
    expected: expectedLevel,
    startedAt: now(),
    reminderAt: null,
    levelAtReminder: null
  };

  // ------------------------------------
  // TIMER
  // ------------------------------------
  activeTimers[channel] = setTimeout(async () => {
    const p = pending[channel];

    if (!p) {
      log("NO PENDING ON TIMER:", channel);
      return;
    }

    await new Promise(r => setTimeout(r, 2000));

    const latest = await getRealLevel(channel);

    log("TIMER CHECK:", channel, latest);

    // ------------------------------------
    // BLUE
    // ------------------------------------
    if (p.expected === "blue") {
      if (isAlert(latest)) {
        log("BLUE REMINDER SKIPPED:", channel, latest);

        delete pending[channel];
        return;
      }

      await sendMessage(
        `❗❗❗ Увага, ви не поставили 🔷 синій рівень тривоги в ${channel}`
      );

      p.reminderAt = now();

      log("BLUE REMINDER SENT:", channel);
    }

    // ------------------------------------
    // GREEN
    // ------------------------------------
    if (p.expected === "green") {
      if (latest === "green") {
        log("GREEN REMINDER SKIPPED:", channel);

        delete pending[channel];
        return;
      }

      await sendMessage(
        `❗❗❗ Увага, ви не поставили ✅ зелений рівень тривоги в ${channel}`
      );

      p.reminderAt = now();
      p.levelAtReminder = latest;

      log("GREEN REMINDER SENT:", channel, latest);
    }

    delete activeTimers[channel];
  }, REMINDER_MS);
}

// ------------------------------------
function cancelTimer(channel, level) {
  log("CANCEL:", channel, level);
}

module.exports = {
  startTimer,
  updateLevel,
  cancelTimer,
  setFetchLatestLevel
};

