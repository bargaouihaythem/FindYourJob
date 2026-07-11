const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// Lister les tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (e, r) => {
  console.log('Tables:', r && r.map(t => t.name).join(', '));
  
  // Chercher les tables liées aux executions
  const execTables = r ? r.filter(t => t.name.includes('exec') || t.name.includes('node')) : [];
  console.log('Exec tables:', execTables.map(t => t.name).join(', '));
  
  // Lire workflow_entity pour voir le workflow actuel
  db.all("SELECT id, name, active FROM workflow_entity WHERE id='abHc50O9XFYNXIa8'", (e2, wf) => {
    if (wf && wf[0]) {
      console.log('\nWorkflow:', wf[0].name, 'active=', wf[0].active);
    }
    
    // Chercher les données dans execution_annotation ou execution_data
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%exec%'", (e3, execT) => {
      console.log('Exec-related tables:', execT && execT.map(t => t.name).join(', '));
      db.close();
    });
  });
});
