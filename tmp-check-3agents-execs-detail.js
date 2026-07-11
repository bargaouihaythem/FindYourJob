const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const ids = [505, 508, 509, 511, 513];
let pending = ids.length;

for (const id of ids) {
  db.get('SELECT data FROM execution_data WHERE executionId=?', [id], (err, row) => {
    if (!err && row && row.data) {
      const t = row.data;
      const probes = ['ETIMEDOUT', 'accepted', 'rejected2', '"response"', 'messageId', 'ECONNRESET', 'EAUTH', 'ACCEPTED', 'REJECTED', 'AUTO_REJECTED', 'candidateId'];
      console.log(`\n=== Execution ${id} ===`);
      probes.forEach((k) => {
        const i = t.indexOf(k);
        if (i >= 0) {
          console.log(`  [${k}]`, t.slice(Math.max(0, i - 30), i + 80).replace(/\n/g, ' '));
        }
      });
    }
    pending -= 1;
    if (pending === 0) db.close();
  });
}
