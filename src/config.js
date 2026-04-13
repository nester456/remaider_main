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
      "Дніпровський район.",
      "Дніпровський",
      "м. Дніпро та тергромада"
    ],

    "Kharkiv Alerts DRC": [
      "м. Харків",
      "м. Харків."
    ],

    "Kherson Alerts DRC": [
      "Херсонський район",
      "Херсонський район.",
      "Херсонський"
    ],

    "Kyiv Alerts DRC": [
      "м. Київ",
      "м. Київ."
    ],

    "Mykolaiv Alerts DRC": [
      "Миколаївський район",
      "Миколаївський район.",
      "Миколаївський"
    ],

    "Shostka Alerts DRC": [
      "Шосткинський район",
      "Шосткинський район.",
      "Шостка",
      "м. Шостка"
    ],

    "Slovyansk Alerts DRC": [
      "Краматорський район",
      "Краматорський район.",
      "Краматорський"
    ],

    "Sumy Alerts DRC": [
      "Сумський район",
      "Сумський район.",
      "Сумський"
    ],

    "Barvinkove Alerts DRC": [
      "Ізюмський район",
      "Ізюмський район.",
      "Ізюмський"
    ],

    "Zaporizhzhia Alerts DRC": [
      "м. Запоріжжя",
      "м. Запоріжжя.",
      "Запоріжжя"
    ]
  }
};