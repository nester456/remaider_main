const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = 35283466;
const apiHash = "aac2dd23372dd5e747dd9e0bf0874a50";

(async () => {
  const client = new TelegramClient(
    new StringSession(""),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => await input.text("📱 Phone: "),
    password: async () => await input.text("🔐 Password: "),
    phoneCode: async () => await input.text("💬 Code: "),
    onError: (err) => console.log(err),
  });

  console.log("\n🔥 SESSION:");
  console.log(client.session.save());

  process.exit();
})();