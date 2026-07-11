const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

console.log('🔧 Correction d\'Agent 1 - Direct DB modification\n');
console.log('DB Path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('❌ Database not found at:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ DB Error:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Database connected\n');
  
  // Récupérer le workflow
  db.get('SELECT id, data FROM workflow_entity WHERE id = ?', ['abHc50O9XFYNXIa8'], (err, row) => {
    if (err) {
      console.error('❌ Query error:', err.message);
      db.close();
      process.exit(1);
    }
    
    if (!row) {
      console.log('❌ Workflow not found');
      db.close();
      process.exit(1);
    }
    
    try {
      const workflow = JSON.parse(row.data);
      console.log('✅ Workflow loaded:', workflow.name);
      console.log('   Nodes:', workflow.nodes.length);
      
      // Corriger le nœud réponse
      const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
      if (responseNode) {
        console.log('\n✏️  Fixing response node...');
        
        // Utiliser la syntaxe correcte n8n
        responseNode.parameters.responseBody = '={"status":"ok","score":$("Score IA — Analyse CV").first().json.score,"mention":$("Score IA — Analyse CV").first().json.mention,"candidateId":$("Score IA — Analyse CV").first().json.candidateId}';
        
        console.log('   ✅ responseBody updated');
      }
      
      // Activer continueOnFail sur les nodes critiques
      workflow.nodes.forEach(n => {
        if (n.type === 'n8n-nodes-base.emailSend' || n.type === 'n8n-nodes-base.code') {
          if (!n.continueOnFail) {
            n.continueOnFail = true;
            console.log('   ✅ continueOnFail enabled on', n.name);
          }
        }
      });
      
      // Mettre à jour la base de données
      db.run('UPDATE workflow_entity SET data = ? WHERE id = ?', [JSON.stringify(workflow), 'abHc50O9XFYNXIa8'], (err) => {
        if (err) {
          console.error('\n❌ Update error:', err.message);
          db.close();
          process.exit(1);
        }
        
        console.log('\n✅ Workflow updated in database!');
        console.log('\n⚠️  IMPORTANT: Restart n8n for changes to take effect');
        console.log('   Run: docker-compose restart n8n');
        console.log('   Or manually stop/start n8n');
        
        db.close();
      });
      
    } catch (parseErr) {
      console.error('❌ Parse error:', parseErr.message);
      db.close();
      process.exit(1);
    }
  });
});
