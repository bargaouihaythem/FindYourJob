const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const wf = 'abHc50O9XFYNXIa8';

db.all('SELECT id FROM execution_entity WHERE workflowId=? ORDER BY id DESC LIMIT 6', [wf], (err, rows) => {
  if (err) {
    console.error(err.message);
    db.close();
    return;
  }

  let pending = rows.length;
  if (!pending) {
    console.log('No executions');
    db.close();
    return;
  }

  for (const r of rows) {
    db.get('SELECT data FROM execution_data WHERE executionId=?', [r.id], (err2, row) => {
      if (err2) {
        console.log(r.id, 'read-error');
      } else {
        const t = (row && row.data) || '';
        const tags = [];
        if (t.includes('NOUVELLE_CANDIDATURE')) tags.push('NOUVELLE_CANDIDATURE');
        if (t.includes('Candidature analysée par IA')) tags.push('ANALYSE_OK');
        const m = t.match(/"score":(\d+)/);
        const score = m ? m[1] : 'n/a';
        console.log(r.id, tags.join('|') || 'NO_TAG', 'score=' + score);
      }

      pending -= 1;
      if (pending === 0) db.close();
    });
  }
});
