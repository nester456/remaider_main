module.exports = {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH,
  session: process.env.SESSION,

  sourceChannel: "air_alert_ua",

  notifyBotToken: process.env.BOT_TOKEN,
  notifyChannelId: process.env.CHANNEL_ID,

channelIds: {
  "-1002737520189": "Dnipro Alerts DRC",
  "-1002880018609": "Kharkiv Alerts DRC",
  "-1003891964449": "Barvinkove Alerts DRC",
  "-1002719951459": "Shostka Alerts DRC",
  "-1002797404503": "Sumy Alerts DRC",
  "-1002525242495": "Kherson Alerts DRC",
  "-1002832814919": "Slovyansk Alerts DRC",
  "-1002876029828": "Zaporizhzhia Alerts DRC",
  "-1002814265584": "Mykolaiv Alerts DRC",
  "-1002552939614": "Kyiv Alerts DRC"
},

  regions: {
    "Dnipro Alerts DRC": ["дніпровський район"],
    "Kharkiv Alerts DRC": ["м харків"],
    "Kherson Alerts DRC": ["херсонський район"],
    "Kyiv Alerts DRC": ["м київ"],
    "Mykolaiv Alerts DRC": ["миколаївський район"],
    "Shostka Alerts DRC": ["шосткинський район"],
    "Slovyansk Alerts DRC": ["краматорський район"],
    "Sumy Alerts DRC": ["сумський район"],
    "Barvinkove Alerts DRC": ["ізюмський район"],
    "Zaporizhzhia Alerts DRC": ["м запоріжжя", "запоріжжя"]
  }
};