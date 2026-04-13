const { db } = require("./storage");
const { sendMessage } = require("./notifier");
const dayjs = require("dayjs");

function formatTime(t) {
  return dayjs(t).format("HH:mm");
}

async function generateReport() {
  await db.read();

  const events = db.data.events;

  if (!events.length) {
    await sendMessage("📊 За зміну не було інцидентів");
    return;
  }

  const grouped = {};

  for (const e of events) {
    if (!grouped[e.channel]) grouped[e.channel] = [];
    grouped[e.channel].push(e);
  }

  let report = "📊 Підсумок за останню зміну:\n\n";

  for (const [channel, items] of Object.entries(grouped)) {
    report += `🔷 ${channel}:\n`;

    for (const e of items) {
      if (e.status === "not_set") {
        if (e.hadRed) {
          report += `– о ${formatTime(e.time)} ❌ не поставлено, був червоний\n`;
        } else {
          report += `– о ${formatTime(e.time)} ❌ рівень не було поставлено\n`;
        }
      }

      if (e.status === "late") {
        report += `– о ${formatTime(e.time)} на ${e.delay} хв\n`;
      }

      if (e.status === "on_time") {
        report += `– о ${formatTime(e.time)} без затримки\n`;
      }
    }

    report += "\n";
  }

  await sendMessage(report);

  db.data.events = [];
  await db.write();
}

module.exports = { generateReport };