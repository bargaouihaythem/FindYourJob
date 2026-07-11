const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const dbPath = path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB OPEN ERROR:', err);
    process.exit(1);
  }
});

const workflowId = 'abHc50O9XFYNXIa8';

function printWorkflow() {
  db.get('SELECT id, name, nodes, connections FROM workflow_entity WHERE id = ?', [workflowId], (err, row) => {
    if (err) {
      console.error('QUERY ERROR:', err);
      db.close();
      process.exit(1);
    }
    if (!row) {
      console.log('No workflow found for id ' + workflowId);
      db.close();
      return;
    }

    try {
      const nodes = JSON.parse(row.nodes || '[]');
      const connections = JSON.parse(row.connections || '{}');
      console.log('WORKFLOW ID:', row.id);
      console.log('WORKFLOW NAME:', row.name);
      console.log('NODE COUNT:', nodes.length);
      console.log('NODE NAMES:');
      for (const n of nodes) {
        console.log(' - ' + n.name + ' :: ' + n.type + ' :: ' + (n.parameters && n.parameters.path ? n.parameters.path : ''));
      }
      console.log('CONNECTION KEYS:', Object.keys(connections).join(' | '));
    } catch (e) {
      console.error('PARSE ERROR:', e);
    } finally {
      db.close();
    }
  });
}

printWorkflow();
