const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// Récupérer les 3 dernières exécutions avec toutes les colonnes disponibles
db.all(`
  SELECT id, workflowId, status, startedAt, stoppedAt, data 
  FROM execution_entity 
  WHERE workflowId IN ('abHc50O9XFYNXIa8', 'aDlMEwef9SLGf0Xd')
  ORDER BY id DESC 
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('Query error:', err);
    db.close();
    return;
  }
  
  console.log('Executions (dernières 5):');
  rows.forEach(row => {
    const wfName = row.workflowId === 'abHc50O9XFYNXIa8' ? 'Agent 1' : 'Agent 3';
    console.log('\n' + wfName + ' | exec=' + row.id + ' | status=' + row.status);
    
    // Essayer de parser les data si présentes
    if (row.data) {
      try {
        const d = JSON.parse(row.data);
        if (d.message) console.log('  message: ' + d.message);
        if (d.resultData && d.resultData.error) console.log('  error: ' + d.resultData.error.message);
      } catch (e) {
        console.log('  data: (binary or complex)');
      }
    }
  });
  
  db.close();
});
