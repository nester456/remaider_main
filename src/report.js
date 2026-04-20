const { db } = require("./storage");
const { sendMessage } = require("./notifier");
const dayjs = require("dayjs");

function formatTime(t) {
  return dayjs(t).format("HH:mm");
}

function renderEvent(e) {
  // ❌ не поставлено
  if (e.status === "not_set") {
    if (e.hadRed) {
      return `– о ${formatTime(e.time)} ❌ рівень не було поставлено, але в цей час в групі був 🚨 червоний рівень`;
    }

    return `– о ${formatTime(e.time)} ❌ рівень не було поставлено`;
  }

  // ⏱ із затримкою
  if (e.status === "late") {
    if (e.hadRed) {
      return `– о ${formatTime(e.time)} на ${e.delay} хв, але в цей час в групі був 🚨 червоний рівень`;
    }

    return `– о ${formatTime(e.time)} на ${e.delay} хв`;
  }

  return null;
}

async function generateReport() {
  await db.read();

  const events = db.data.events || [];

  // Беремо лише проблемні кейси
  const filtered = events.filter(
    (e) => e.status === "late" || e.status === "not_set"
  );

  if (!filtered.length) {
    await sendMessage(
      "📊✅ За минулу зміну всі рівні було виставлено без затримок"
    );

    db.data.events = [];
    await db.write();
    return;
  }

  const grouped = {};

  for (const e of filtered) {
    if (!grouped[e.channel]) {
      grouped[e.channel] = {
        blue: [],
        green: []
      };
    }

    if (e.type === "blue") grouped[e.channel].blue.push(e);
    if (e.type === "green") grouped[e.channel].green.push(e);
  }

  let report = "📊 Підсумок за останню зміну:\n\n";

  for (const [channel, data] of Object.entries(grouped)) {
    // 🔷 BLUE BLOCK
    if (data.blue.length) {
      report += `🔷 ${channel}: затримка синього:\n`;

      for (const e of data.blue) {
        const line = renderEvent(e);
        if (line) report += `${line}\n`;
      }

      report += "\n";
    }

    // ✅ GREEN BLOCK
    if (data.green.length) {
      report += `✅ ${channel}: затримка зеленого:\n`;

      for (const e of data.green) {
        const line = renderEvent(e);
        if (line) report += `${line}\n`;
      }

      report += "\n";
    }
  }

  await sendMessage(report.trim());

  // очищаємо після звіту
  db.data.events = [];
  await db.write();
}

module.exports = { generateReport };