const path = require('path');
const Database = require(path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'npm', 'node_modules', 'n8n', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const row = db.prepare('SELECT id, status, error, data FROM execution_entity WHERE id = ?').get(337);
if (!row) {
  console.log('Execution 337 not found');
  process.exit(0);
}

console.log('Execution:', { id: row.id, status: row.status, error: row.error });

try {
  const parsed = row.data ? JSON.parse(row.data) : null;
  const runData = parsed?.resultData?.runData || {};
  const keys = Object.keys(runData);
  console.log('Nodes in runData:', keys);

  for (const key of keys) {
    const items = runData[key];
    if (Array.isArray(items) && items[0]?.error) {
      console.log('\nNode error on:', key);
      console.log(JSON.stringify(items[0].error, null, 2));
    }
  }
} catch (e) {
  console.log('Failed to parse execution data:', e.message);
}

db.close();
