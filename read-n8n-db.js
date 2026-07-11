// Utiliser sqlite3 (module de n8n) pour lire les détails d'exécution
const path = require('path');
const n8nRoot = path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'npm', 'node_modules', 'n8n');
const sqlite3Path = path.join(n8nRoot, 'node_modules', 'sqlite3');

const sqlite3 = require(sqlite3Path);
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

// Récupérer les dernières exécutions Agent 1
db.all(
  `SELECT id, workflowId, status, startedAt, stoppedAt 
   FROM execution_entity 
   WHERE workflowId = 'abHc50O9XFYNXIa8' 
   ORDER BY id DESC LIMIT 3`,
  (err, rows) => {
    if (err) { console.error('Query error:', err); return; }
    console.log('\n=== Dernières exécutions Agent 1 ===');
    rows.forEach(r => console.log(`ID=${r.id} status=${r.status}`));
    
    if (!rows.length) return db.close();
    
    const latestId = rows[0].id;
    
    // Lire les données de la plus récente
    db.get('SELECT data FROM execution_entity WHERE id = ?', [latestId], (err2, row) => {
      if (err2) { console.error(err2); db.close(); return; }
      if (!row || !row.data) { console.log('No data'); db.close(); return; }
      
      try {
        const d = JSON.parse(row.data);
        const rd = d.resultData && d.resultData.runData;
        if (rd) {
          Object.keys(rd).forEach(nodeName => {
            const nodeData = rd[nodeName];
            if (nodeData && nodeData[0]) {
              const nd = nodeData[0];
              let info = `  [${nodeName}]`;
              if (nd.error) {
                info += ` ERROR: ${nd.error.message || nd.error.description || JSON.stringify(nd.error).substring(0, 100)}`;
              } else {
                info += ' OK';
              }
              console.log(info);
              
              // Pour le noeud Sauvegarder, afficher les details
              if (nodeName.includes('Sauvegarder') && nd.source) {
                console.log('    source:', JSON.stringify(nd.source).substring(0, 200));
              }
            }
          });
        }
        
        // Chercher l'URL qui a été appellée
        const saveScoreData = rd && (rd['Spring Boot \u2014 Sauvegarder score'] || rd['Spring Boot - Sauvegarder score']);
        if (saveScoreData && saveScoreData[0] && saveScoreData[0].error) {
          const errDetail = saveScoreData[0].error;
          console.log('\n=== Detail erreur Sauvegarder score ===');
          console.log(JSON.stringify(errDetail, null, 2).substring(0, 800));
        }
      } catch (parseErr) {
        console.log('Parse error:', parseErr.message);
      }
      
      db.close();
    });
  }
);
