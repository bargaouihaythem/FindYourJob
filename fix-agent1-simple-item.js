const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzc4MzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
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

async function fixAgent1WithSplitter() {
  console.log('[Agent 1] Ajout d\'un Split node pour la réponse...\n');
  
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT1_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Trouver et modifier le nœud réponse pour une simple réponse brute
  const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  if (responseNode) {
    // Réponse extrêmement simple directe
    responseNode.parameters = {
      respondWith: 'json',
      responseBody: '={"status":"success","score":$("Score IA — Analyse CV").item.json.score,"mention":$("Score IA — Analyse CV").item.json.mention,"candidateId":$("Score IA — Analyse CV").item.json.candidateId}',
      options: {}
    };
    console.log('✅ Response node avec syntaxe simplifiée');
  }
  
  const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT1_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (updateResp.status === 200 || updateResp.status === 201) {
    console.log('✅ Agent 1 mis à jour!\n');
  } else {
    console.log('❌ Erreur PUT:', updateResp.status);
    console.log(JSON.stringify(updateResp.body).substring(0, 300));
  }
}

fixAgent1WithSplitter().catch((e) => console.error('Error:', e.message));
