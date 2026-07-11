const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const AGENT3_ID = 'aDlMEwef9SLGf0Xd';

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

async function fixAgent3() {
  console.log('[Agent 3] Correction du flux et retour réponse...\n');
  
  // Obtenir le workflow actuel
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT3_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Ajouter continueOnFail sur tous les Email nodes
  let emailCount = 0;
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.emailSend') {
      node.continueOnFail = true;
      emailCount++;
    }
  });
  console.log('✅ continueOnFail activé sur ' + emailCount + ' Email nodes');
  
  // Créer ou corriger le nœud de réponse
  let responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  
  if (!responseNode) {
    console.log('❌ Aucun nœud réponse webhook trouvé');
    return;
  }
  
  responseNode.parameters = {
    respondWith: 'json',
    responseBody: `={{
  "status": "ok",
  "message": "Interview planifiée et confirmée",
  "interviewDate": $input.first().json.interviewDate,
  "interviewType": $input.first().json.interviewType,
  "candidateName": $input.first().json.firstName + " " + $input.first().json.lastName
}}`,
    options: {}
  };
  console.log('✅ responseBody configuré');
  
  // S'assurer que la réponse est reachable dans les connexions
  const emailNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.emailSend').map(n => n.name);
  const lastEmailNodeName = emailNodes[emailNodes.length - 1];
  
  if (lastEmailNodeName && !workflow.connections[lastEmailNodeName]) {
    workflow.connections[lastEmailNodeName] = {
      main: [[{ node: 'Réponse webhook', type: 'main', index: 0 }]]
    };
  } else if (lastEmailNodeName) {
    if (!workflow.connections[lastEmailNodeName].main[0]) {
      workflow.connections[lastEmailNodeName].main[0] = [];
    }
    const alreadyConnected = workflow.connections[lastEmailNodeName].main[0].some(c => c.node === 'Réponse webhook');
    if (!alreadyConnected) {
      workflow.connections[lastEmailNodeName].main[0].push({ node: 'Réponse webhook', type: 'main', index: 0 });
    }
  }
  console.log('✅ Connexions du workflow vérifiées');
  
  // Mettre à jour le workflow
  const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT3_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (updateResp.status === 200 || updateResp.status === 201) {
    console.log('\n✅ Agent 3 corrigé!\n');
  } else {
    console.log('\n❌ Erreur PUT:', updateResp.status);
    console.log(JSON.stringify(updateResp.body).substring(0, 300));
  }
}

fixAgent3().catch((e) => console.error('Erreur:', e.message));
