const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const AGENT1_ID = 'abHc50O9XFYNXIa8';
const AGENT3_ID = 'aDlMEwef9SLGf0Xd';

const workflowsDir = path.join(__dirname, 'n8n-workflows');

function httpRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function reloadWorkflow(filePath, workflowId, name) {
  console.log('[' + name + '] Réimport...');
  
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ Fichier non trouvé: ' + filePath);
    return false;
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const workflow = JSON.parse(fileContent);
  
  console.log('  Nom: ' + workflow.name);
  console.log('  Noeuds: ' + workflow.nodes.length);
  
  // Envoyer la mise à jour via l'API REST
  const resp = await httpRequest('PUT', '/api/v1/workflows/' + workflowId, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (resp.status === 200 || resp.status === 201) {
    console.log('  ✅ OK');
    return true;
  } else {
    console.log('  ❌ Erreur HTTP ' + resp.status);
    console.log('     ' + JSON.stringify(resp.body).substring(0, 200));
    return false;
  }
}

async function main() {
  console.log('=== RECHARGEMENT WORKFLOWS N8N ===\n');
  
  await reloadWorkflow(
    path.join(workflowsDir, 'agent1-cv-parser.json'),
    AGENT1_ID,
    'Agent 1'
  );
  
  console.log('');
  
  await reloadWorkflow(
    path.join(workflowsDir, 'agent3-entretien.json'),
    AGENT3_ID,
    'Agent 3'
  );
  
  console.log('\n✅ Workflows rechargés. Relancez node test-agents.js\n');
}

main().catch((e) => console.error('Erreur:', e.message));
