const fs = require('fs');
const path = require('path');

const tmpDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
const inputFile = path.join(tmpDir, 'agent1.json');
const outputFile = path.join(tmpDir, 'agent1-final.json');

const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
// n8n exports as array [{...}] or single object
const workflow = Array.isArray(raw) ? raw[0] : raw;
console.log('Nodes found:', workflow.nodes ? workflow.nodes.length : 'NONE');

// 1. Fix webhook node
const webhookNode = workflow.nodes.find(n => n.id === 'webhook-agent1');
if (webhookNode) {
  webhookNode.webhookId = 'agent1-cv-parser';
  delete webhookNode.parameters.webhookId;
  webhookNode.parameters.responseMode = 'lastNode';
  console.log('Webhook node fixed');
}

// 2. Remove Respond to Webhook node
const before = workflow.nodes.length;
workflow.nodes = workflow.nodes.filter(n => n.type !== 'n8n-nodes-base.respondToWebhook');
console.log(`Removed Respond nodes: ${before - workflow.nodes.length}`);
console.log(`Remaining nodes: ${workflow.nodes.length}`);

fs.writeFileSync(outputFile, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Saved to', outputFile);
