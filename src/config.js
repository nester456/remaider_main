module.exports = {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH,
  session: process.env.SESSION,

  sourceChannel: "air_alert_ua",

  notifyBotToken: process.env.BOT_TOKEN,
  notifyChannelId: process.env.CHANNEL_ID,

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

  regions: {
    "Dnipro Alerts DRC": ["дніпровський район", "дніпровський", "м дніпро", "дніпро"],
    "Kharkiv Alerts DRC": ["м харків", "харків"],
    "Kherson Alerts DRC": ["херсонський район", "херсонський"],
    "Kyiv Alerts DRC": ["м київ", "київ"],
    "Mykolaiv Alerts DRC": ["миколаївський район", "миколаївський"],
    "Shostka Alerts DRC": ["шосткинський район", "шостка", "м шостка"],
    "Slovyansk Alerts DRC": ["краматорський район", "краматорський"],
    "Sumy Alerts DRC": ["сумський район", "сумський"],
    "Barvinkove Alerts DRC": ["ізюмський район", "ізюмський"],
    "Zaporizhzhia Alerts DRC": ["м запоріжжя", "запоріжжя"]
  }
};