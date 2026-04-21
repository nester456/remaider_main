// src/report.js

const { db } = require("./storage");
const { sendMessage } = require("./notifier");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

// ------------------------------------
// Kyiv time
// ------------------------------------
function formatTime(ts) {
  return dayjs(ts).tz("Europe/Kyiv").format("HH:mm");
}

// ------------------------------------
// render one event
// ------------------------------------
function renderEvent(e) {
  // =========================
  // BLUE
  // =========================
  if (e.type === "blue") {
    if (e.status === "late") {
      return `– о ${formatTime(e.time)} на ${e.delay} хв`;
    }

    if (e.status === "not_set") {
      return `– о ${formatTime(e.time)} ❌ синій рівень не було поставлено`;
    }
  }

  // =========================
  // GREEN
  // =========================
  if (e.type === "green") {
    if (e.status === "late") {
      if (e.hadRed) {
        return `– о ${formatTime(e.time)} на ${e.delay} хв, але в момент відбою в групі був 🚨 червоний рівень`;
      }

      if (e.hadYellow) {
        return `– о ${formatTime(e.time)} на ${e.delay} хв, але в момент відбою в групі був 🟡 жовтий рівень`;
      }

      return `– о ${formatTime(e.time)} на ${e.delay} хв`;
    }

    if (e.status === "not_set") {
      if (e.hadRed) {
        return `– о ${formatTime(e.time)} ❌ зелений рівень не було поставлено, а в момент відбою був 🚨 червоний рівень`;
      }

      if (e.hadYellow) {
        return `– о ${formatTime(e.time)} ❌ зелений рівень не було поставлено, а в момент відбою був 🟡 жовтий рівень`;
      }

      return `– о ${formatTime(e.time)} ❌ зелений рівень не було поставлено`;
    }
  }

  return null;
}

// ------------------------------------
// main report
// ------------------------------------
async function generateReport() {
  await db.read();

  const events = db.data.events || [];

  // only issues
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
    // BLUE
    if (data.blue.length) {
      report += `🔷 ${channel}: затримка синього:\n`;

      for (const e of data.blue) {
        const line = renderEvent(e);
        if (line) report += `${line}\n`;
      }

      report += "\n";
    }

    // GREEN
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

  // clear after report
  db.data.events = [];
  await db.write();
}

module.exports = { generateReport };