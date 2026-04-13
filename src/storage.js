const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDB() {
  await db.read();

  db.data ||= {
    events: [],
    lastLevels: {},
    stats: {}
  };

  await db.write();
}

async function saveLevel(channel, level) {
  db.data.lastLevels[channel] = level;
  await db.write();
}

function getLastLevel(channel) {
  return db.data.lastLevels[channel] || null;
}

async function addEvent(event) {
  db.data.events.push(event);
  await db.write();
}

module.exports = {
  db,
  initDB,
  saveLevel,
  getLastLevel,
  addEvent
};