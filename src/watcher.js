const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

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

  console.log("💾 save level:", channel, level);

  await saveLevel(channel, level);
}

// 🔹 старт таймера
async function startTimer(channel, expectedLevel) {
  const current = getLastLevel(channel);

  console.log("🧠 current level:", channel, current);

  // ❗ НЕ блокуємо blue через state
  if (expectedLevel === "blue" && current === "blue") {
    console.log(`⛔ ${channel} вже blue`);
    return;
  }

  if (expectedLevel === "green" && current === "green") {
    console.log(`⛔ ${channel} вже green`);
    return;
  }

  // ❗ не дублюємо таймер
  if (activeTimers[channel]) {
    console.log(`⛔ таймер вже є для ${channel}`);
    return;
  }

  const startTime = Date.now();

  console.log(`⏱ Таймер для ${channel} (${expectedLevel})`);

  activeTimers[channel] = {
    timer: setTimeout(async () => {
      const finalLevel = getLastLevel(channel);

      console.log("🔍 final level:", channel, finalLevel);

      // =========================
      // 🔷 BLUE
      // =========================
      if (expectedLevel === "blue") {

        if (finalLevel === "blue") {
          const delayMin = Math.floor((Date.now() - startTime) / 60000);

          await addEvent({
            channel,
            expectedLevel,
            status: delayMin === 0 ? "on_time" : "late",
            delay: delayMin,
            time: new Date().toISOString(),
            hadRed: false
          });

          console.log(`✅ blue поставлено (${delayMin} хв)`);

          delete activeTimers[channel];
          return;
        }

        await sendMessage(
          `❗❗❗ Увага, ви не поставили 🔷 *синій* рівень тривоги в ${channel}`
        );

        await addEvent({
          channel,
          expectedLevel,
          status: "not_set",
          time: new Date().toISOString(),
          hadRed: finalLevel === "red"
        });

        delete activeTimers[channel];
        return;
      }

      // =========================
      // ✅ GREEN
      // =========================
      if (expectedLevel === "green") {

        if (finalLevel === "green") {
          const delayMin = Math.floor((Date.now() - startTime) / 60000);

          await addEvent({
            channel,
            expectedLevel,
            status: delayMin === 0 ? "on_time" : "late",
            delay: delayMin,
            time: new Date().toISOString(),
            hadRed: false
          });

          console.log(`✅ green поставлено (${delayMin} хв)`);

          delete activeTimers[channel];
          return;
        }

        await sendMessage(
          `❗❗❗ Увага, ви не поставили ✅ *зелений* рівень тривоги в ${channel}`
        );

        await addEvent({
          channel,
          expectedLevel,
          status: "not_set",
          time: new Date().toISOString(),
          hadRed: finalLevel === "red"
        });

        delete activeTimers[channel];
        return;
      }

    }, 60000),

    startTime
  };
}

// 🔹 скасування таймера
function cancelTimer(channel, newLevel) {
  const entry = activeTimers[channel];
  if (!entry) return;

  clearTimeout(entry.timer);

  const delayMin = Math.floor((Date.now() - entry.startTime) / 60000);

  addEvent({
    channel,
    expectedLevel: newLevel,
    status: "on_time",
    delay: delayMin,
    time: new Date().toISOString(),
    hadRed: false
  });

  delete activeTimers[channel];

  console.log(`✅ Таймер скасовано ${channel}`);
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};