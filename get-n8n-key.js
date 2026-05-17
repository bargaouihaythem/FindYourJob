const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.all("SELECT apiKey FROM user_api_keys LIMIT 1", (e, rows) => {
  if (!rows || !rows[0]) { console.log('no key'); db.close(); return; }
  console.log(rows[0].apiKey);
  db.close();
});
