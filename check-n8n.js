const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, email, firstName, role FROM user LIMIT 10', (e, rows) => {
  if (e) { console.error('users error:', e.message); }
  else { console.log('Users:', JSON.stringify(rows, null, 2)); }

  db.all('SELECT id, label, "apiKey" FROM user_api_keys LIMIT 10', (e2, keys) => {
    if (e2) { console.log('No API keys table or error:', e2.message); }
    else { console.log('API Keys:', JSON.stringify(keys, null, 2)); }

    db.all("SELECT id, name, active FROM workflow_entity LIMIT 20", (e3, wf) => {
      if (e3) { console.log('workflows error:', e3.message); }
      else { console.log('Workflows:', JSON.stringify(wf, null, 2)); }
      db.close();
    });
  });
});
