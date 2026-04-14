const { sendMessage } = require("./notifier");
const { getLastLevel, saveLevel, addEvent } = require("./storage");

const activeTimers = {};

function detectLevel(text) {
  if (text.includes("🔷")) return "blue";
  if (text.includes("✅")) return "green";
  if (text.includes("🟡")) return "yellow";
  if (text.includes("🚨")) return "red";
  return null;
}

async function updateLevel(channel, text) {
  const level = detectLevel(text);
  if (!level) return;

  console.log(`📊 UPDATE ${channel}: ${level}`);
  await saveLevel(channel, level);
}

function startTimer(channel, expectedLevel) {
  if (activeTimers[channel]) return;

  console.log(`⏱ START TIMER ${channel}`);

  const startTime = Date.now();

  activeTimers[channel] = setTimeout(async () => {
    const finalLevel = getLastLevel(channel);

    if (finalLevel !== expectedLevel) {
      await sendMessage(`❗ Не виставлено ${expectedLevel} у ${channel}`);
      await addEvent({
        channel,
        status: "not_set",
        time: new Date().toISOString()
      });
    }

    delete activeTimers[channel];

  }, 60000);
}

function cancelTimer(channel, level) {
  if (!activeTimers[channel]) return;

  clearTimeout(activeTimers[channel]);
  delete activeTimers[channel];

  console.log(`✅ TIMER STOP ${channel} (${level})`);
}

module.exports = {
  updateLevel,
  startTimer,
  cancelTimer
};