const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.all('SELECT id, status FROM execution_entity WHERE workflowId=? ORDER BY id DESC LIMIT 20', ['vuIc7XWE1gcN4hBG'], (err, rows) => {
  if (err) {
    console.error(err.message);
    db.close();
    return;
  }

  if (!rows.length) {
    console.log('NO_NEW_EXEC');
    db.close();
    return;
  }

  let pending = rows.length;
  const out = [];

  for (const r of rows) {
    db.get('SELECT data FROM execution_data WHERE executionId=?', [r.id], (e2, row2) => {
      const t = (row2 && row2.data) || '';
      const isC32 = t.includes('"candidateId":32');
      if (isC32) {
        out.push({
          executionId: r.id,
          status: r.status,
          accepted: t.includes('ACCEPTED'),
          rejected: t.includes('REJECTED'),
          timeout: t.includes('ETIMEDOUT')
        });
      }

      pending -= 1;
      if (pending === 0) {
        console.log(JSON.stringify(out, null, 2));
        db.close();
      }
    });
  }
});
