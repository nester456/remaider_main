const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const REMINDER_MS = 60000;
const FAST_SWITCH_MS = 90000;

const activeTimers = {};
const pending = {};

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
// live check
// ------------------------------------
async function getRealLevel(channel) {
  const saved = getLastLevel(channel);

  if (saved !== null) {
    log("LIVE CHECK SKIP:", channel, saved);
    return saved;
  }

  if (!fetchLatestLevelFn) return null;

  try {
    const text = await fetchLatestLevelFn(channel);
    const level = detectLevel(text);

    if (level) {
      await saveLevel(channel, level);
      log("LIVE LEVEL SAVED:", channel, level);
      return level;
    }
  } catch (err) {
    log("LIVE ERROR:", err.message);
  }

  return null;
}

// ------------------------------------
// LEVEL UPDATE (PRIVATE GROUP)
// ------------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  await saveLevel(channel, level);
  log("LEVEL UPDATE:", channel, level);

  const p = pending[channel];
  if (!p) return;

  // ❗ ВАЖЛИВО: без reminder нічого не пишемо
  if (!p.reminderAt) {
    log("NO REMINDER → SKIP EVENT:", channel);
    return;
  }

  // -------- BLUE --------
  if (p.expected === "blue" && level === "blue") {
    const delay = Math.round((now() - p.reminderAt) / 60000);

    await addEvent({
      channel,
      type: "blue",
      time: p.startedAt,
      status: delay === 0 ? "on_time" : "late",
      delay
    });

    log("BLUE EVENT:", channel, delay);

    delete pending[channel];
    return;
  }

  // -------- GREEN --------
  if (p.expected === "green" && level === "green") {
    const delay = Math.round((now() - p.reminderAt) / 60000);

    await addEvent({
      channel,
      type: "green",
      time: p.startedAt,
      status: delay === 0 ? "on_time" : "late",
      delay,
      hadRed: p.levelAtReminder === "red",
      hadYellow: p.levelAtReminder === "yellow"
    });

    log("GREEN EVENT:", channel, delay);

    delete pending[channel];
    return;
  }
}

// ------------------------------------
// START TIMER (PUBLIC ALERT)
// ------------------------------------
async function startTimer(channel, expectedLevel) {
  log("START TIMER:", channel, expectedLevel);

  const current = await getRealLevel(channel);

  // очистка таймера
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel]);
    delete activeTimers[channel];
  }

  // FAST SWITCH
  const old = pending[channel];
  if (old) {
    const age = now() - old.startedAt;

    if (age < FAST_SWITCH_MS) {
      log("FAST SWITCH IGNORE:", channel);
      delete pending[channel];
    }
  }

  // skip логіка
  if (expectedLevel === "blue" && isAlert(current)) {
    log("SKIP BLUE (already alert):", channel);
    return;
  }

  if (expectedLevel === "green" && current === "green") {
    log("SKIP GREEN (already green):", channel);
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
    if (!p) return;

    const latest = await getRealLevel(channel);

    log("TIMER FIRED:", channel, latest);

    // -------- BLUE --------
    if (p.expected === "blue") {
      if (latest !== "blue") {
        await sendMessage(
          `❗❗❗ Увага, ви не поставили 🔷 синій рівень тривоги в ${channel}`
        );

        p.reminderAt = now();
        log("BLUE REMINDER SENT:", channel);
      } else {
        log("BLUE REMINDER SKIPPED:", channel);
      }
    }

    // -------- GREEN --------
    if (p.expected === "green") {
      if (latest !== "green") {
        await sendMessage(
          `❗❗❗ Увага, ви не поставили ✅ зелений рівень тривоги в ${channel}`
        );

        p.reminderAt = now();
        p.levelAtReminder = latest;

        log("GREEN REMINDER SENT:", channel);
      } else {
        log("GREEN REMINDER SKIPPED:", channel);
      }
    }

    delete activeTimers[channel];
  }, REMINDER_MS);
}

// ------------------------------------
// FINAL CHECK (NOT SET)
// ------------------------------------
setInterval(async () => {
  for (const channel in pending) {
    const p = pending[channel];

    if (!p.reminderAt) continue;

    const age = now() - p.reminderAt;

    if (age > 5 * 60000) {
      await addEvent({
        channel,
        type: p.expected,
        time: p.startedAt,
        status: "not_set",
        hadRed: p.levelAtReminder === "red",
        hadYellow: p.levelAtReminder === "yellow"
      });

      log("FINAL NOT_SET:", channel);

      delete pending[channel];
    }
  }
}, 60000);

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