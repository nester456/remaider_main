module.exports = {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH,
  session: process.env.SESSION,

  sourceChannel: "air_alert_ua",

  notifyBotToken: process.env.BOT_TOKEN,
  notifyChannelId: process.env.CHANNEL_ID,

  // 🔥 МАПА ID → КАНАЛ
  channelIds: {
    "2737520189": "Dnipro Alerts DRC",
    "2880018609": "Kharkiv Alerts DRC",
    "3891964449": "Barvinkove Alerts DRC",
    "2719951459": "Shostka Alerts DRC",
    "2797404503": "Sumy Alerts DRC",
    "2525242495": "Kherson Alerts DRC",
    "2832814919": "Slovyansk Alerts DRC",
    "2876029828": "Zaporizhzhia Alerts DRC",
    "2814265584": "Mykolaiv Alerts DRC",
    "2552939614": "Kyiv Alerts DRC"
  },

  // (твій старий mapping залишаємо)
  regions: {
    "Dnipro Alerts DRC": ["Дніпровський район", "Дніпровський", "м. Дніпро"],
    "Kharkiv Alerts DRC": ["м. Харків", "Харків"],
    "Kherson Alerts DRC": ["Херсонський район", "Херсонський"],
    "Kyiv Alerts DRC": ["м. Київ", "Київ"],
    "Mykolaiv Alerts DRC": ["Миколаївський район", "Миколаївський"],
    "Shostka Alerts DRC": ["Шосткинський район", "Шостка"],
    "Slovyansk Alerts DRC": ["Краматорський район", "Краматорський"],
    "Sumy Alerts DRC": ["Сумський район", "Сумський"],
    "Barvinkove Alerts DRC": ["Ізюмський район", "Ізюмський"],
    "Zaporizhzhia Alerts DRC": ["м. Запоріжжя", "Запоріжжя"]
  }
};