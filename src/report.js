const { db } = require("./storage");
const { sendMessage } = require("./notifier");
const dayjs = require("dayjs");

function formatTime(t) {
  return dayjs(t).add(3, "hour").format("HH:mm");
}

// пріоритет
function pickWorst(events) {
  const notSet = events.find(e => e.status === "not_set");
  if (notSet) return notSet;

  const late = events.find(e => e.status === "late");
  if (late) return late;

  return events[0]; // on_time
}

async function generateReport() {
  await db.read();

  const events = db.data.events;

  if (!events.length) {
    await sendMessage("📊✅ За зміну всі рівні виставлено без затримок");
    return;
  }

  // ------------------------------------
  // 1. групування
  // ------------------------------------
  const grouped = {};

  for (const e of events) {
    const key = `${e.channel}_${e.type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  // ------------------------------------
  // 2. merge близьких подій
  // ------------------------------------
  const merged = {};

  for (const key in grouped) {
    const sorted = grouped[key].sort((a, b) => a.time - b.time);

    merged[key] = [];
    let buffer = [];

    for (const e of sorted) {
      if (!buffer.length) {
        buffer.push(e);
        continue;
      }

      const last = buffer[buffer.length - 1];

      if (e.time - last.time < 30 * 60 * 1000) {
        buffer.push(e);
      } else {
        merged[key].push(pickWorst(buffer));
        buffer = [e];
      }
    }

    if (buffer.length) {
      merged[key].push(pickWorst(buffer));
    }
  }

  // ------------------------------------
  // 3. формування звіту
  // ------------------------------------
  let report = "📊 Підсумок за останню зміну:\n\n";

  const channelMap = {};

  for (const key in merged) {
    const [channel, type] = key.split("_");

    if (!channelMap[channel]) {
      channelMap[channel] = { blue: [], green: [] };
    }

    channelMap[channel][type] = merged[key];
  }

  for (const channel in channelMap) {
    const data = channelMap[channel];

    // -------- BLUE --------
    if (data.blue.length) {
      let block = "";

      for (const e of data.blue) {
        if (e.status === "not_set") {
          block += `– о ${formatTime(e.time)} ❌ синій рівень не було поставлено\n`;
        }

        if (e.status === "late") {
          block += `– о ${formatTime(e.time)} на ${e.delay} хв\n`;
        }

        if (e.status === "on_time") {
          block += `– о ${formatTime(e.time)} ✅ без затримки\n`;
        }
      }

      if (block) {
        report += `🔷 ${channel}:\n${block}\n`;
      }
    }

    // -------- GREEN --------
    if (data.green.length) {
      let block = "";

      for (const e of data.green) {
        if (e.status === "not_set") {
          if (e.hadRed) {
            block += `– о ${formatTime(e.time)} ❌ зелений не було поставлено, був 🚨 червоний рівень\n`;
          } else if (e.hadYellow) {
            block += `– о ${formatTime(e.time)} ❌ зелений не було поставлено, був 🟡 жовтий рівень\n`;
          } else {
            block += `– о ${formatTime(e.time)} ❌ зелений рівень не було поставлено\n`;
          }
        }

        if (e.status === "late") {
          if (e.hadRed) {
            block += `– о ${formatTime(e.time)} на ${e.delay} хв (був 🚨 червоний)\n`;
          } else if (e.hadYellow) {
            block += `– о ${formatTime(e.time)} на ${e.delay} хв (був 🟡 жовтий)\n`;
          } else {
            block += `– о ${formatTime(e.time)} на ${e.delay} хв\n`;
          }
        }

        if (e.status === "on_time") {
          block += `– о ${formatTime(e.time)} ✅ без затримки\n`;
        }
      }

      if (block) {
        report += `✅ ${channel}:\n${block}\n`;
      }
    }
  }

  await sendMessage(report);

  // ------------------------------------
  // 4. очистка
  // ------------------------------------
  db.data.events = [];
  await db.write();
}

module.exports = { generateReport };