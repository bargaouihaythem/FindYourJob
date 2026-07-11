const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.get('SELECT data FROM execution_data WHERE executionId=?', [451], (err, row) => {
  if (err || !row) {
    console.error(err ? err.message : 'no row');
    db.close();
    return;
  }
  const t = row.data || '';
  console.log('has35', t.includes('"candidateId":35'));
  console.log('has36', t.includes('"candidateId":36'));
  console.log('ACCEPTED', t.includes('ACCEPTED'));
  console.log('REJECTED', t.includes('REJECTED'));
  console.log('ETIMEDOUT', t.includes('ETIMEDOUT'));
  db.close();
});
