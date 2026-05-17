const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const { execSync } = require('child_process');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// Lire les webhooks enregistrés pour Agent 1
db.all(
  "SELECT webhookPath, method, workflowId, node FROM webhook_entity WHERE workflowId='abHc50O9XFYNXIa8'",
  (e, rows) => {
    console.log('=== Webhooks enregistrés Agent 1 ===');
    if (rows && rows.length) {
      rows.forEach(r => console.log(`path=${r.webhookPath} method=${r.method}`));
    } else {
      console.log('AUCUN webhook enregistré pour abHc50O9XFYNXIa8!');
    }
    
    // Lire la version active du workflow (workflow_published_version)
    db.all("SELECT * FROM workflow_published_version WHERE workflowId='abHc50O9XFYNXIa8'", (e2, pvRows) => {
      console.log('\n=== Version publiée ===');
      if (pvRows && pvRows.length) {
        pvRows.forEach(r => {
          const nodes = r.nodes ? JSON.parse(r.nodes) : [];
          const hn = nodes.find && nodes.find(n => n.name && n.name.includes('Sauvegarder'));
          console.log(`publishedAt=${r.publishedAt || r.createdAt}`);
          if (hn) console.log('URL publiée:', hn.parameters.url);
        });
      } else {
        console.log('Pas de version publiée');
      }
      
      // Comparer avec workflow_entity
      db.all("SELECT active, updatedAt FROM workflow_entity WHERE id='abHc50O9XFYNXIa8'", (e3, wfRows) => {
        if (wfRows && wfRows[0]) {
          console.log('\n=== Workflow entity ===');
          console.log('active:', wfRows[0].active, 'updatedAt:', wfRows[0].updatedAt);
        }
        db.close();
      });
    });
  }
);
