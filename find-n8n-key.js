const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// Chercher une clé API dans user_api_keys
db.all("SELECT apiKey, label, userId FROM user_api_keys LIMIT 5", (e, rows) => {
  if (e) { console.log('Error user_api_keys:', e.message); }
  console.log('=== API Keys ===');
  if (rows && rows.length) {
    rows.forEach(r => console.log(`label=${r.label} key=${r.apiKey ? r.apiKey.substring(0,20)+'...' : 'null'}`));
  } else {
    console.log('Aucune cle API trouvee');
  }
  
  // Chercher l'owner user
  db.all("SELECT id, email, role FROM user LIMIT 5", (e2, users) => {
    console.log('\n=== Users ===');
    if (users) users.forEach(u => console.log(`id=${u.id} email=${u.email} role=${u.role}`));
    db.close();
  });
});
