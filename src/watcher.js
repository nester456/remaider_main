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

  // 🔷 синій тільки після зеленого
  if (expectedLevel === "blue" && current !== "green") {
    console.log(`⛔ skip ${channel} — не було green`);
    return;
  }

  // ❗ якщо вже потрібний рівень — нічого не робимо
  if (current === expectedLevel) {
    console.log(`⛔ ${channel} вже має ${expectedLevel}`);
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

      // 🔥 ДОДАТКОВІ ПЕРЕВІРКИ (як у старому боті)

      // якщо синій вже не актуальний
      if (expectedLevel === "blue" && finalLevel !== "green") {
        console.log(`ℹ️ skip blue reminder — рівень вже змінився`);
        delete activeTimers[channel];
        return;
      }

      // якщо зелений вже не актуальний
      if (expectedLevel === "green" && finalLevel !== "blue") {
        console.log(`ℹ️ skip green reminder — рівень вже змінився`);
        delete activeTimers[channel];
        return;
      }

      // ❗ якщо рівень НЕ встановлено
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
        // ⏱ був встановлений, але із затримкою
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

// 🔹 скасування таймера (коли рівень поставили)
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

    console.log(`✅ Таймер скасовано ${channel}`);
  }
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};