const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel } = require("./storage");

const activeTimers = {};

// 🔹 визначення рівня
function detectLevel(text) {
  if (!text) return null;

  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🚨")) return "red";

  return null;
}

// 🔹 оновлення рівня
async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  console.log("💾 SAVE LEVEL:", channel, level);

  await saveLevel(channel, level);
}

// 🔹 старт таймера
async function startTimer(channel, expectedLevel) {
  const current = getLastLevel(channel);

  console.log("\n🚀 START TIMER");
  console.log("📍 CHANNEL:", channel);
  console.log("🎯 EXPECTED:", expectedLevel);
  console.log("🧠 CURRENT LEVEL:", current);

  // =========================
  // 🔷 BLUE reminder потрібен
  // тільки якщо ДО цього був green
  // =========================
  if (expectedLevel === "blue" && current !== "green") {
    console.log("⛔ skip blue — already active alert");
    return;
  }

  // =========================
  // ✅ GREEN reminder не треба
  // якщо вже green
  // =========================
  if (expectedLevel === "green" && current === "green") {
    console.log("⛔ вже green — skip");
    return;
  }

  // вже існує таймер
  if (activeTimers[channel]) {
    console.log("⛔ таймер вже існує");
    return;
  }

  activeTimers[channel] = {
    timer: setTimeout(async () => {
      const finalLevel = getLastLevel(channel);

      console.log("\n⏱ TIMER FIRED");
      console.log("📍 CHANNEL:", channel);
      console.log("🎯 EXPECTED:", expectedLevel);
      console.log("🔍 FINAL LEVEL:", finalLevel);

      // =========================
      // 🔷 BLUE
      // =========================
      if (expectedLevel === "blue") {
        if (
          finalLevel === "blue" ||
          finalLevel === "yellow" ||
          finalLevel === "red"
        ) {
          console.log("✅ BLUE OK / already active");

          delete activeTimers[channel];
          return;
        }

        console.log("❗ BLUE NOT SET → SEND REMINDER");

        await sendMessage(
          `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
        );

        delete activeTimers[channel];
        return;
      }

      // =========================
      // ✅ GREEN
      // =========================
      if (expectedLevel === "green") {
        if (finalLevel === "green") {
          console.log("✅ GREEN OK — поставлено");

          delete activeTimers[channel];
          return;
        }

        // якщо вже нова тривога активна
        if (
          finalLevel === "blue" ||
          finalLevel === "yellow" ||
          finalLevel === "red"
        ) {
          console.log("ℹ️ skip green reminder — нова тривога активна");

          delete activeTimers[channel];
          return;
        }

        console.log("❗ GREEN NOT SET → SEND REMINDER");

        await sendMessage(
          `❗❗❗ Увага, ви не поставили ✅ *зелений* рівень тривоги в ${channel}`
        );

        delete activeTimers[channel];
        return;
      }

    }, 60000)
  };
}

// 🔹 скасування таймера
function cancelTimer(channel, newLevel) {
  const entry = activeTimers[channel];

  console.log("\n🛑 CANCEL TIMER TRY");
  console.log("📍 CHANNEL:", channel);
  console.log("📊 NEW LEVEL:", newLevel);
  console.log("⏱ HAS TIMER:", !!entry);

  if (!entry) return;

  clearTimeout(entry.timer);

  console.log("✅ TIMER CANCELLED:", channel);

  delete activeTimers[channel];
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};