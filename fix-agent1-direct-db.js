const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

console.log('🔧 Correction d\'Agent 1 directement en base de données...\n');
console.log('DB Path:', dbPath);

try {
  const db = new sqlite3.Database(dbPath);
  
  // Récupérer le workflow Agent 1
  const getStmt = db.prepare('SELECT id, data FROM workflow_entity WHERE id = ?');
  const row = getStmt.get('abHc50O9XFYNXIa8');
  
  if (!row) {
    console.log('❌ Workflow not found');
    db.close();
    process.exit(1);
  }
  
  const workflow = JSON.parse(row.data);
  console.log('✅ Workflow chargé:', workflow.name);
  console.log('   Nœuds:', workflow.nodes.length);
  
  // Corriger le nœud réponse webhook
  const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  if (responseNode) {
    console.log('\n✏️  Modification du nœud réponse...');
    
    // Approche ultra-simple : réponse brute depuis le Code node
    responseNode.parameters.responseBody = '={"status":"ok","score":$("Score IA — Analyse CV").first().json.score,"mention":$("Score IA — Analyse CV").first().json.mention,"candidateId":$("Score IA — Analyse CV").first().json.candidateId}';
    
    console.log('   ✅ responseBody mis à jour');
  }
  
  // S'assurer que le Code node a continueOnFail
  const codeNode = workflow.nodes.find(n => n.name === 'Score IA — Analyse CV');
  if (codeNode && !codeNode.continueOnFail) {
    codeNode.continueOnFail = true;
    console.log('   ✅ continueOnFail activé sur Code node');
  }
  
  // S'assurer que Email a continueOnFail
  const emailNode = workflow.nodes.find(n => n.name === 'Email — Confirmation candidat');
  if (emailNode && !emailNode.continueOnFail) {
    emailNode.continueOnFail = true;
    console.log('   ✅ continueOnFail activé sur Email node');
  }
  
  // Mettre à jour en base de données
  const updateStmt = db.prepare('UPDATE workflow_entity SET data = ? WHERE id = ?');
  updateStmt.run(JSON.stringify(workflow), 'abHc50O9XFYNXIa8');
  
  console.log('\n✅ Workflow mis à jour en base de données!');
  console.log('\n⚠️  Redémarrage de n8n requis pour appliquer les changements...');
  
  db.close();
  
} catch (err) {
  console.error('❌ Erreur:', err.message);
  if (err.message.includes('Cannot find module')) {
    console.log('\nInstall better-sqlite3:');
    console.log('npm install better-sqlite3');
  }
  process.exit(1);
}
