const sqlite3 = require('C:/Users/hbargaoui/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const AGENTS = [
  { id: 'abHc50O9XFYNXIa8', label: 'Agent 1' },
  { id: 'aDlMEwef9SLGf0Xd', label: 'Agent 2' },
  { id: 'vuIc7XWE1gcN4hBG', label: 'Agent 3' },
];

let pending = AGENTS.length;

for (const agent of AGENTS) {
  db.get('SELECT id, name, active, nodes, connections FROM workflow_entity WHERE id=?', [agent.id], (err, row) => {
    if (err || !row) {
      console.log(`\n=== ${agent.label} (${agent.id}) === NOT FOUND / ERROR`);
      pending -= 1;
      if (pending === 0) db.close();
      return;
    }

    const nodes = JSON.parse(row.nodes || '[]');
    const connections = JSON.parse(row.connections || '{}');

    console.log(`\n${'='.repeat(70)}`);
    console.log(`${agent.label} : "${row.name}"  (active=${row.active})`);
    console.log('='.repeat(70));

    console.log('NODES:');
    nodes.forEach((n) => {
      console.log(`  - [${n.type}] "${n.name}"`);
    });

    console.log('\nCONNECTIONS:');
    for (const [from, outputs] of Object.entries(connections)) {
      const mains = outputs.main || [];
      mains.forEach((branch, idx) => {
        (branch || []).forEach((target) => {
          console.log(`  ${from}  --(out ${idx})-->  ${target.node}`);
        });
      });
    }

    console.log('\nHUGGINGFACE CHECK:');
    const rawText = JSON.stringify(nodes);
    const hits = ['huggingface', 'HuggingFace', 'HUGGINGFACE', 'api-inference'];
    let found = false;
    hits.forEach((h) => {
      if (rawText.includes(h)) {
        found = true;
        console.log(`  !! Reference trouvee: "${h}"`);
      }
    });
    if (!found) console.log('  OK - aucune reference HuggingFace dans ce workflow');

    pending -= 1;
    if (pending === 0) db.close();
  });
}
