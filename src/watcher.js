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

  await saveLevel(channel, level);
}

// 🔹 старт таймера
async function startTimer(channel, expectedLevel) {
  const current = getLastLevel(channel);

  // ❗ синій тільки після зеленого
  if (expectedLevel === "blue" && current !== "green") {
    console.log(`⛔ Пропуск ${channel} — не було зеленого`);
    return;
  }

  // ❗ якщо вже правильний рівень стоїть — не запускаємо
  if (current === expectedLevel) {
    console.log(`⛔ ${channel} вже має рівень ${expectedLevel}`);
    return;
  }

  if (activeTimers[channel]) return;

  const startTime = Date.now();

  console.log(`⏱ Таймер для ${channel}`);

  activeTimers[channel] = {
    timer: setTimeout(async () => {
      const finalLevel = getLastLevel(channel);

      if (finalLevel !== expectedLevel) {
        await sendMessage(
          `❗❗❗ Увага, ви не поставили ${
            expectedLevel === "blue"
              ? "🔷 *синій*"
              : "✅ *зелений*"
          } рівень тривоги в ${channel}`
        );

        await addEvent({
          channel,
          expectedLevel,
          status: "not_set",
          time: new Date().toISOString(),
          hadRed: finalLevel === "red"
        });

      } else {
        const delayMin = Math.floor((Date.now() - startTime) / 60000);

        await addEvent({
          channel,
          expectedLevel,
          status: "late",
          delay: delayMin,
          time: new Date().toISOString(),
          hadRed: false
        });
      }

      delete activeTimers[channel];

    }, 60000),

    startTime
  };
}

// 🔹 скасування
function cancelTimer(channel, newLevel) {
  const entry = activeTimers[channel];
  if (!entry) return;

  if (newLevel === "blue" || newLevel === "green") {
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

    console.log(`✅ Скасовано таймер ${channel}`);
  }
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};