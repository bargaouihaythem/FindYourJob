const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const ids = [];
for (let i = 406; i <= 452; i += 1) ids.push(i);

let pending = ids.length;
const out = [];

for (const id of ids) {
  db.get('SELECT data FROM execution_data WHERE executionId=?', [id], (err, row) => {
    if (!err && row && row.data) {
      const t = row.data;
      const has35 = t.includes('"candidateId":35');
      const has36 = t.includes('"candidateId":36');
      if (has35 || has36) {
        let st = 'OTHER';
        if (t.includes('ACCEPTED')) st = 'ACCEPTED';
        else if (t.includes('REJECTED')) st = 'REJECTED';
        out.push({ id, candidate: has35 ? 35 : 36, status: st, timeout: t.includes('ETIMEDOUT') });
      }
    }

    pending -= 1;
    if (pending === 0) {
      out.sort((a, b) => a.id - b.id);
      console.log(JSON.stringify(out, null, 2));
      db.close();
    }
  });
}
