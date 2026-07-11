const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.get('SELECT id, workflowId, status, error, startedAt, stoppedAt FROM execution_entity WHERE id = ?', [337], (e, row) => {
  if (e) {
    console.error('execution_entity read error:', e.message);
    db.close();
    return;
  }
  console.log('execution_entity:', row);

  db.get('SELECT data FROM execution_data WHERE executionId = ?', [337], (e2, row2) => {
    if (e2) {
      console.error('execution_data read error:', e2.message);
      db.close();
      return;
    }

    if (!row2 || !row2.data) {
      console.log('No execution_data for 337');
      db.close();
      return;
    }

    try {
      const parsed = JSON.parse(row2.data);
      const runData = parsed?.resultData?.runData || {};
      console.log('runData nodes:', Object.keys(runData));
      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        if (Array.isArray(nodeRuns) && nodeRuns[0] && nodeRuns[0].error) {
          console.log('\nError node:', nodeName);
          console.log(JSON.stringify(nodeRuns[0].error, null, 2));
        }
      }
    } catch (parseErr) {
      console.log('Could not parse execution_data JSON:', parseErr.message);
      console.log('Raw snippet:', String(row2.data).slice(0, 400));
    }

    db.close();
  });
});
