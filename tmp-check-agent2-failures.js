const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.all("SELECT id, status, startedAt, stoppedAt FROM execution_entity WHERE workflowId='aDlMEwef9SLGf0Xd' ORDER BY id DESC LIMIT 10", (err, rows) => {
  if (err) { console.error(err.message); db.close(); return; }
  console.log(rows);

  const failedIds = rows.filter((r) => r.status !== 'success').map((r) => r.id);
  if (!failedIds.length) { db.close(); return; }

  let pending = failedIds.length;
  for (const id of failedIds) {
    db.get('SELECT data FROM execution_data WHERE executionId=?', [id], (e2, row2) => {
      const t = (row2 && row2.data) || '';
      const probes = ['ETIMEDOUT', 'ECONNREFUSED', 'EAUTH', 'candidateFirst', 'error', 'message'];
      console.log(`\n=== Execution ${id} (failed) ===`);
      probes.forEach((k) => {
        const i = t.indexOf(k);
        if (i >= 0) console.log(`  [${k}]`, t.slice(Math.max(0, i - 40), i + 100).replace(/\n/g, ' '));
      });
      pending -= 1;
      if (pending === 0) db.close();
    });
  }
});
