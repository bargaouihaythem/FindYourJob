const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB OPEN ERROR:', err);
    process.exit(1);
  }
});

// Agent 1 workflow ID
const agent1Id = 'abHc50O9XFYNXIa8';
const agent3Id = 'aDlMEwef9SLGf0Xd';

function checkWorkflowErrors(workflowId, name) {
  return new Promise((resolve) => {
    db.get(
      'SELECT id, workflowId, status, startedAt FROM execution_entity WHERE workflowId = ? ORDER BY id DESC LIMIT 1',
      [workflowId],
      (err, row) => {
        if (err) {
          console.error(name + ' query error:', err);
          resolve();
          return;
        }
        
        if (!row) {
          console.log(name + ': No recent executions');
          resolve();
          return;
        }
        
        console.log(name + ' execution:', row.id, 'status:', row.status);
        
        db.get('SELECT data FROM execution_data WHERE executionId = ?', [row.id], (err2, dataRow) => {
          if (err2 || !dataRow) {
            console.log(name + ': No execution data');
            resolve();
            return;
          }
          
          try {
            const d = JSON.parse(dataRow.data);
            const rd = d.resultData && d.resultData.runData;
            if (rd) {
              Object.keys(rd).forEach(nodeName => {
                const nodeData = rd[nodeName];
                if (nodeData && nodeData[0]) {
                  const nd = nodeData[0];
                  if (nd.error) {
                    console.log('  ERROR [' + nodeName + ']:', nd.error.message || nd.error.description || JSON.stringify(nd.error).substring(0, 100));
                  }
                }
              });
            }
          } catch (parseErr) {
            console.log(name + ': Cannot parse execution data');
          }
          resolve();
        });
      }
    );
  });
}

(async () => {
  console.log('=== AGENT 1 LOG ===');
  await checkWorkflowErrors(agent1Id, 'Agent 1');
  console.log('\n=== AGENT 3 LOG ===');
  await checkWorkflowErrors(agent3Id, 'Agent 3');
  db.close();
})();
