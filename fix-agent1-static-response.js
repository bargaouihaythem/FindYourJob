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

async function fixAgent1Simple() {
  console.log('[Agent 1] Test avec réponse statique...\n');
  
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT1_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Mettre à jour le nœud de réponse avec une réponse statique simple
  const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  if (responseNode) {
    // Réponse complètement statique pour tester
    responseNode.parameters.responseBody = '={"status":"ok","score":85,"mention":"Test OK","candidateId":99}';
    console.log('✅ Response body mis à jour');
  }
  
  const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT1_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (updateResp.status === 200 || updateResp.status === 201) {
    console.log('\n✅ Agent 1 mis à jour!\n');
  } else {
    console.log('\n❌ Erreur PUT:', updateResp.status);
    console.log('Message:', JSON.stringify(updateResp.body).substring(0, 300));
  }
}

fixAgent1Simple().catch((e) => console.error('Error:', e.message));
