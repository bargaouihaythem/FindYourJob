const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.all('SELECT executionId, data FROM execution_data WHERE executionId > ? ORDER BY executionId ASC', [405], (err, rows) => {
  if (err) {
    console.error(err.message);
    db.close();
    return;
  }

  const out = [];
  for (const r of rows) {
    const t = r.data || '';
    const has35 = t.includes('"candidateId":35');
    const has36 = t.includes('"candidateId":36');
    if (!has35 && !has36) continue;

    let status = 'OTHER';
    if (t.includes('ACCEPTED')) status = 'ACCEPTED';
    else if (t.includes('REJECTED')) status = 'REJECTED';

    out.push({
      executionId: r.executionId,
      candidateId: has35 ? 35 : 36,
      status,
      timeout: t.includes('ETIMEDOUT'),
      authError: t.includes('EAUTH') || t.includes('Invalid login'),
    });
  }

  console.log(JSON.stringify(out, null, 2));
  db.close();
});
