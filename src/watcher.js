const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const activeTimers = {};
const TIMER_MS = 60000;

// ----------------------------------
// detect level
// ----------------------------------
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🚨")) return "red";

  return null;
}

// ----------------------------------
// normalize active states
// ----------------------------------
function isAlertActive(level) {
  return level === "blue" || level === "yellow" || level === "red";
}

// ----------------------------------
// update level from private channel
// ----------------------------------
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  console.log("💾 SAVE LEVEL:", channel, level);

  await saveLevel(channel, level);
}

// ----------------------------------
// start timer
// ----------------------------------
async function startTimer(channel, expectedLevel) {
  let current = getLastLevel(channel);

  console.log("\n🚀 START TIMER");
  console.log("📍 CHANNEL:", channel);
  console.log("🎯 EXPECTED:", expectedLevel);
  console.log("🧠 CURRENT:", current);

  // remove old timer
  if (activeTimers[channel]) {
    clearTimeout(activeTimers[channel].timer);
    delete activeTimers[channel];
  }

  // ==================================
  // BLUE expected after alert
  // reminder only if current = green/null
  // ==================================
  if (expectedLevel === "blue") {
    if (isAlertActive(current)) {
      console.log("⛔ BLUE skip — alert already active");
      return;
    }
  }

  // ==================================
  // GREEN expected after clear
  // reminder if current != green
  // ==================================
  if (expectedLevel === "green") {
    if (current === "green") {
      console.log("⛔ GREEN skip — already green");
      return;
    }
  }

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

      // ==================================
      // BLUE reminder
      // ==================================
      if (expectedLevel === "blue") {
        if (isAlertActive(finalLevel)) {
          console.log("✅ BLUE OK");

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

      // ==================================
      // GREEN reminder
      // ==================================
      if (expectedLevel === "green") {
        if (finalLevel === "green") {
          console.log("✅ GREEN OK");

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
        return;
      }

    }, TIMER_MS)
  };
}

// ----------------------------------
// cancel timer when correct level set
// ----------------------------------
async function cancelTimer(channel, newLevel) {
  const entry = activeTimers[channel];

  console.log("\n🛑 CANCEL TIMER TRY");
  console.log("📍 CHANNEL:", channel);
  console.log("📊 NEW LEVEL:", newLevel);
  console.log("⏱ HAS TIMER:", !!entry);

  if (!entry) return;

  clearTimeout(entry.timer);

  const delay = Math.round((Date.now() - entry.startedAt) / 60000);

  if (
    (entry.expectedLevel === "blue" && isAlertActive(newLevel)) ||
    (entry.expectedLevel === "green" && newLevel === "green")
  ) {
    await addEvent({
      channel,
      type: entry.expectedLevel,
      status: delay === 0 ? "on_time" : "late",
      delay,
      time: entry.startedAt,
      hadRed: newLevel === "red"
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