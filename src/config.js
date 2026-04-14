module.exports = {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH,
  session: process.env.SESSION,

  sourceChannel: "air_alert_ua",

  notifyBotToken: process.env.BOT_TOKEN,
  notifyChannelId: process.env.CHANNEL_ID,

  regions: {
    "Dnipro Alerts DRC": [
      "Дніпровський район",
      "Дніпровський",
      "м. Дніпро"
    ],
    "Kharkiv Alerts DRC": [
      "м. Харків",
      "Харків"
    ],
    "Kherson Alerts DRC": [
      "Херсонський район",
      "Херсонський"
    ],
    "Kyiv Alerts DRC": [
      "м. Київ",
      "Київ"
    ],
    "Mykolaiv Alerts DRC": [
      "Миколаївський район",
      "Миколаївський"
    ],
    "Shostka Alerts DRC": [
      "Шосткинський район",
      "Шостка"
    ],
    "Slovyansk Alerts DRC": [
      "Краматорський район",
      "Краматорський"
    ],
    "Sumy Alerts DRC": [
      "Сумський район",
      "Сумський"
    ],
    "Barvinkove Alerts DRC": [
      "Ізюмський район",
      "Ізюмський"
    ],
    "Zaporizhzhia Alerts DRC": [
      "м. Запоріжжя",
      "Запоріжжя"
    ]
  }
};