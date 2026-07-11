const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.all("SELECT status, COUNT(*) c FROM execution_entity WHERE workflowId='aDlMEwef9SLGf0Xd' AND id>560 GROUP BY status", (err, rows) => {
  console.log(rows);
  db.close();
});
