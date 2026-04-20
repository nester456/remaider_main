const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const activeTimers = {};
const TIMER_MS = 60000;

// -------------------------
// detect level
// -------------------------
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🚨")) return "red";

  return null;
}

// -------------------------
// update level from channel
// -------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  console.log("💾 SAVE LEVEL:", channel, level);

  await saveLevel(channel, level);
}

// -------------------------
// start timer
// -------------------------
async function startTimer(channel, expectedLevel) {
  const current = getLastLevel(channel);

  console.log("\n🚀 START TIMER");
  console.log("📍 CHANNEL:", channel);
  console.log("🎯 EXPECTED:", expectedLevel);
  console.log("🧠 CURRENT:", current);

  // remove old timer
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel].timer);
    delete activeTimers[channel];
  }

  // ======================
  // BLUE logic
  // reminder only if was green
  // ======================
  if (expectedLevel === "blue" && current !== "green") {
    console.log("⛔ BLUE skip — alert already active");
    return;
  }

  // ======================
  // GREEN logic
  // always check after clear
  // ======================

  const startedAt = Date.now();

  activeTimers[channel] = {
    expectedLevel,
    startedAt,

    timer: setTimeout(async () => {
      const finalLevel = getLastLevel(channel);

      console.log("\n⏱ TIMER FIRED");
      console.log("📍 CHANNEL:", channel);
      console.log("🎯 EXPECTED:", expectedLevel);
      console.log("🔍 FINAL:", finalLevel);

      // ======================
      // BLUE expected
      // ======================
      if (expectedLevel === "blue") {
        if (
          finalLevel === "blue" ||
          finalLevel === "yellow" ||
          finalLevel === "red"
        ) {
          await addEvent({
            channel,
            type: "blue",
            status: "on_time",
            time: startedAt
          });

          delete activeTimers[channel];
          return;
        }

        await sendMessage(
          `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
        );

        await addEvent({
          channel,
          type: "blue",
          status: "not_set",
          time: startedAt,
          hadRed: false
        });

        delete activeTimers[channel];
        return;
      }

      // ======================
      // GREEN expected
      // ======================
      if (expectedLevel === "green") {
        if (finalLevel === "green") {
          await addEvent({
            channel,
            type: "green",
            status: "on_time",
            time: startedAt
          });

          delete activeTimers[channel];
          return;
        }

        await sendMessage(
          `❗❗❗ Увага, ви не поставили ✅ *зелений* рівень тривоги в ${channel}`
        );

        await addEvent({
          channel,
          type: "green",
          status: "not_set",
          time: startedAt,
          hadRed: finalLevel === "red"
        });

        delete activeTimers[channel];
      }

    }, TIMER_MS)
  };
}

// -------------------------
// cancel timer when level updated
// -------------------------
async function cancelTimer(channel, newLevel) {
  const entry = activeTimers[channel];

  console.log("\n🛑 CANCEL TIMER TRY");
  console.log("📍 CHANNEL:", channel);
  console.log("📊 NEW LEVEL:", newLevel);
  console.log("⏱ HAS TIMER:", !!entry);

  if (!entry) return;

  clearTimeout(entry.timer);

  const delay = Math.round((Date.now() - entry.startedAt) / 60000);

  // correct level placed
  if (
    (entry.expectedLevel === "blue" && newLevel === "blue") ||
    (entry.expectedLevel === "green" && newLevel === "green")
  ) {
    await addEvent({
      channel,
      type: entry.expectedLevel,
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: entry.startedAt
    });
  }

  console.log("✅ TIMER CANCELLED:", channel);

  delete activeTimers[channel];
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};