async function startTimer(channel, expectedLevel) {
  const current = getLastLevel(channel);

  // 🔥 1. Якщо рівень вже виставлений — НЕ запускаємо таймер
  if (current === expectedLevel) {
    console.log(`⛔ ${channel} вже має рівень ${expectedLevel}`);
    return;
  }

  // 🔥 2. Якщо вже був red — теж НЕ треба blue
  if (expectedLevel === "blue" && current === "red") {
    console.log(`⛔ ${channel} вже має RED — пропускаємо blue`);
    return;
  }

  // 🔥 3. Синій тільки після зеленого
  if (expectedLevel === "blue" && current !== "green") {
    console.log(`⛔ Пропуск ${channel} — не було зеленого`);
    return;
  }

  // 🔥 4. Якщо таймер вже є — не дублюємо
  if (activeTimers[channel]) {
    console.log(`⛔ Таймер вже існує для ${channel}`);
    return;
  }

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