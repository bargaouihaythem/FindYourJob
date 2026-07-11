const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const AGENT1_ID = 'abHc50O9XFYNXIa8';

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

async function restructureAgent1() {
  console.log('[Agent 1] Restructuration complète du flux...\n');
  
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT1_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Stratégie : Webhook → Code → Split en 2 branches :
  // Branche 1: Email + HTTP (pour les actions)
  // Branche 2: Response (pour la réponse)
  
  console.log('Nœuds actuels:');
  workflow.nodes.forEach(n => console.log('  - ' + n.name + ' (' + n.type.split('.').pop() + ')'));
  
  // Vérifier que tous les nœuds existent
  const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  const codeNode = workflow.nodes.find(n => n.name === 'Score IA — Analyse CV');
  const emailNode = workflow.nodes.find(n => n.name === 'Email — Confirmation candidat');
  const httpNode = workflow.nodes.find(n => n.name === 'Spring Boot — Sauvegarder score');
  const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  
  if (!webhookNode || !codeNode || !emailNode || !httpNode || !responseNode) {
    console.log('❌ Nœud manquant!');
    return;
  }
  
  // Reconstruire les connexions de manière claire
  // Le Code node doit avoir 2 sorties : une vers Email+HTTP, une vers Response
  workflow.connections = {
    'Webhook — Nouvelle candidature': {
      main: [[{ node: 'Score IA — Analyse CV', type: 'main', index: 0 }]]
    },
    'Score IA — Analyse CV': {
      main: [[
        { node: 'Email — Confirmation candidat', type: 'main', index: 0 },
        { node: 'Spring Boot — Sauvegarder score', type: 'main', index: 0 },
        { node: 'Réponse webhook', type: 'main', index: 0 }
      ]]
    },
    'Email — Confirmation candidat': {
      main: [[]]
    },
    'Spring Boot — Sauvegarder score': {
      main: [[]]
    }
  };
  console.log('✅ Connexions restructurées');
  console.log('   Code node → Email, HTTP, et Response (branches parallèles)');
  
  // Activer continueOnFail sur Email
  emailNode.continueOnFail = true;
  
  const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT1_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (updateResp.status === 200 || updateResp.status === 201) {
    console.log('\n✅ Agent 1 restructuré!\n');
  } else {
    console.log('\n❌ Erreur PUT:', updateResp.status);
    console.log('Message:', JSON.stringify(updateResp.body).substring(0, 300));
  }
}

restructureAgent1().catch((e) => console.error('Error:', e.message));
