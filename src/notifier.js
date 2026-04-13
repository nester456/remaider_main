const axios = require("axios");
const config = require("./config");

async function sendMessage(text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${config.notifyBotToken}/sendMessage`,
      {
        chat_id: config.notifyChannelId,
        text,
        parse_mode: "Markdown"
      }
    );
  } catch (err) {
    console.error("❌ Notify error:", err.message);
  }
}

module.exports = { sendMessage };