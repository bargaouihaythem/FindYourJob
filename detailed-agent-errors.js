const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB OPEN ERROR:', err);
    process.exit(1);
  }
});

const agent1Id = 'abHc50O9XFYNXIa8';
const agent3Id = 'aDlMEwef9SLGf0Xd';

function getDetailedError(workflowId, name) {
  return new Promise((resolve) => {
    db.get(
      'SELECT id FROM execution_entity WHERE workflowId = ? ORDER BY id DESC LIMIT 1',
      [workflowId],
      (err, row) => {
        if (err || !row) {
          console.log(name + ': No execution found');
          resolve();
          return;
        }

        const execId = row.id;
        db.get('SELECT data FROM execution_data WHERE executionId = ?', [execId], (err2, dataRow) => {
          if (err2 || !dataRow) {
            console.log(name + ': No execution data');
            resolve();
            return;
          }

          try {
            const d = JSON.parse(dataRow.data);
            const rd = d.resultData && d.resultData.runData;
            
            console.log('\n' + name + ' EXECUTION NODES:');
            if (rd) {
              Object.keys(rd).forEach(nodeName => {
                const nodeData = rd[nodeName];
                if (nodeData && nodeData[0]) {
                  const nd = nodeData[0];
                  if (nd.error) {
                    console.log('  ❌ [' + nodeName + ']:');
                    console.log('     message: ' + (nd.error.message || 'N/A'));
                    console.log('     description: ' + (nd.error.description || 'N/A'));
                    if (nd.error.cause) {
                      console.log('     cause: ' + JSON.stringify(nd.error.cause).substring(0, 300));
                    }
                  } else {
                    console.log('  ✅ [' + nodeName + ']: OK');
                  }
                }
              });
            }
          } catch (parseErr) {
            console.log(name + ': Parse error: ' + parseErr.message);
          }
          
          resolve();
        });
      }
    );
  });
}

(async () => {
  await getDetailedError(agent1Id, 'AGENT 1');
  await getDetailedError(agent3Id, 'AGENT 3');
  db.close();
})();
