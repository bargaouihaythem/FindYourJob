const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

db.get('SELECT nodes FROM workflow_entity WHERE id=?', ['abHc50O9XFYNXIa8'], (err, row) => {
  if (err || !row) { console.error(err ? err.message : 'not found'); db.close(); return; }
  const nodes = JSON.parse(row.nodes || '[]');

  const email = nodes.find((n) => n.name === 'Email — Confirmation candidat');
  console.log('=== Email confirmation node ===');
  console.log(JSON.stringify(email.parameters, null, 2));

  const save = nodes.find((n) => n.name === 'Spring Boot — Sauvegarder score');
  console.log('\n=== Spring Boot Sauvegarder score node ===');
  console.log(JSON.stringify(save.parameters, null, 2));

  const respond = nodes.find((n) => n.name === 'Réponse webhook');
  console.log('\n=== Réponse webhook node (full) ===');
  console.log(JSON.stringify(respond, null, 2));

  const webhook = nodes.find((n) => n.name === 'Webhook — Nouvelle candidature');
  console.log('\n=== Webhook node params ===');
  console.log(JSON.stringify(webhook.parameters, null, 2));

  db.close();
});

