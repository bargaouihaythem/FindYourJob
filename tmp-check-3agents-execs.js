const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

const ids = ['abHc50O9XFYNXIa8', 'aDlMEwef9SLGf0Xd', 'vuIc7XWE1gcN4hBG'];

db.all(
  'SELECT id, workflowId, status, startedAt, stoppedAt FROM execution_entity WHERE workflowId IN (?,?,?) ORDER BY id DESC LIMIT 30',
  ids,
  (err, rows) => {
    if (err) {
      console.error('Query error:', err.message);
      db.close();
      return;
    }

    const nameById = {
      abHc50O9XFYNXIa8: 'Agent 1',
      aDlMEwef9SLGf0Xd: 'Agent 2',
      vuIc7XWE1gcN4hBG: 'Agent 3',
    };

    rows.forEach((r) => {
      console.log(`${r.id}\t${nameById[r.workflowId]}\t${r.status}\t${r.startedAt}`);
    });

    db.close();
  }
);
