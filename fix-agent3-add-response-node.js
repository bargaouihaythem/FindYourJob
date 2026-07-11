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
  console.log('[Agent 3] Ajout du nœud de réponse webhook...\n');
  
  // Obtenir le workflow actuel
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT3_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Changer responseMode en responseNode
  workflow.nodes[0].parameters.responseMode = 'responseNode';
  console.log('✅ responseMode changé en responseNode');
  
  // Ajouter continueOnFail sur tous les Email nodes
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.emailSend') {
      node.continueOnFail = true;
    }
  });
  console.log('✅ continueOnFail activé sur Email nodes');
  
  // Ajouter le nœud de réponse webhook
  const responseNode = {
    parameters: {
      respondWith: 'json',
      responseBody: `={{
  "status": "ok",
  "message": "Entretien planifié avec succès",
  "interviewId": $input.first().json.interviewId,
  "candidateName": $input.first().json.candidateFirst + " " + $input.first().json.candidateLast,
  "interviewDate": $input.first().json.interviewDate
}}`,
      options: {}
    },
    id: 'webhook-response',
    name: 'Réponse webhook',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [960, 300]
  };
  
  workflow.nodes.push(responseNode);
  console.log('✅ Nœud réponse webhook ajouté');
  
  // Mettre à jour les connexions pour que les emails pointent vers la réponse
  const emailCandidatNode = 'Email — Candidat (convocation)';
  const emailRhNode = 'Email — RH (confirmation planification)';
  
  // Trouver les emails et les connecter à la réponse
  if (!workflow.connections[emailCandidatNode]) {
    workflow.connections[emailCandidatNode] = {
      main: [[{ node: 'Réponse webhook', type: 'main', index: 0 }]]
    };
  } else if (!workflow.connections[emailCandidatNode].main[0]) {
    workflow.connections[emailCandidatNode].main[0] = [{ node: 'Réponse webhook', type: 'main', index: 0 }];
  } else {
    const alreadyConnected = workflow.connections[emailCandidatNode].main[0].some(c => c.node === 'Réponse webhook');
    if (!alreadyConnected) {
      workflow.connections[emailCandidatNode].main[0].push({ node: 'Réponse webhook', type: 'main', index: 0 });
    }
  }
  
  if (!workflow.connections[emailRhNode]) {
    workflow.connections[emailRhNode] = {
      main: [[{ node: 'Réponse webhook', type: 'main', index: 0 }]]
    };
  } else if (!workflow.connections[emailRhNode].main[0]) {
    workflow.connections[emailRhNode].main[0] = [{ node: 'Réponse webhook', type: 'main', index: 0 }];
  } else {
    const alreadyConnected = workflow.connections[emailRhNode].main[0].some(c => c.node === 'Réponse webhook');
    if (!alreadyConnected) {
      workflow.connections[emailRhNode].main[0].push({ node: 'Réponse webhook', type: 'main', index: 0 });
    }
  }
  console.log('✅ Connexions mises à jour');
  
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
