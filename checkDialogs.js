const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = 35283466;
const apiHash = "aac2dd23372dd5e747dd9e0bf0874a50";

// ❗ ВСТАВ СЮДИ СВОЮ НОВУ SESSION
const session = "1AgAOMTQ5LjE1NC4xNjcuNTABu1kallp2AKpGH2NeO8Y5gzdYImj3V6sCOoHoo5Ify6d7LglYAVfq8K7tz3Zkj/Q6Zjk6jz/fTC6fr9fYmpk38SWP4W3u67me3Y7REimXyGAy6tMWuzcNtoW5+pDuQdaBMJm0QIrUO3Qly2/gIvLbcTltDzAd2nxJRsWnVitthStnP9rqc3mCyjocpAwK/sRhf0bC61UfpZfq9GubSIPbtFMbPNRL38zfMjrYKrs5jM/zdv/C1dqLbzmxnRb2HsqzNgpWiwLS14azwAwpxigHFGy+QH8KFJV46gAGr9u63vg2a8nKXmzyGYUJ0jU7dXG2WvUMFwROqNFVP1WHb3vJhUA=";

(async () => {
  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  await client.start();

  console.log("✅ Connected");

  const dialogs = await client.getDialogs();

  console.log("\n📡 СПИСОК ВСІХ ЧАТІВ:\n");

  dialogs.forEach(d => {
    console.log("👉", d.name);
  });

  console.log("\n🔍 ФІЛЬТР Alerts:\n");

  dialogs
    .filter(d => d.name && d.name.includes("Alerts"))
    .forEach(d => {
      console.log("🟢", d.name);
    });

  process.exit();
})();