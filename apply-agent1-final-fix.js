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

async function fixAgent1Final() {
  console.log('[Agent 1] Configuration finale...\n');
  
  const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT1_ID);
  if (getResp.status !== 200) {
    console.log('❌ Erreur GET:', getResp.status);
    return;
  }
  
  const workflow = getResp.body;
  
  // Modifier le Code node pour préparer AUSSI la réponse
  const codeNode = workflow.nodes.find(n => n.name === 'Score IA — Analyse CV');
  if (codeNode) {
    codeNode.parameters.jsCode = `// Données reçues depuis Spring Boot
const data = $input.first().json;

const candidateId   = data.candidateId;
const firstName     = data.firstName || 'Candidat';
const lastName      = data.lastName  || '';
const email         = data.email;
const jobTitle      = data.jobOfferTitle || 'le poste';
const cvContent     = data.cvContent || '';

// Score IA simulé (en production : appeler OpenAI/Mistral)
const score = Math.floor(Math.random() * 30) + 65; // 65-95
const mention = score >= 85 ? 'Excellent profil' : score >= 60 ? 'Bon profil' : 'Profil insuffisant';

return [
  {
    json: {
      candidateId,
      firstName,
      lastName,
      email,
      jobTitle,
      cvContent,
      score,
      mention,
      processedAt: new Date().toISOString(),
      responsePayload: {
        status: 'ok',
        score,
        mention,
        candidateId,
        message: 'Candidature analysée par IA'
      }
    }
  }
];`;
    console.log('✅ Code node modifié');
  }
  
  // Modifier la réponse webhook pour accéder à responsePayload
  const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
  if (responseNode) {
    responseNode.parameters.responseBody = '=$("Score IA — Analyse CV").first().json.responsePayload';
    console.log('✅ Response node mis à jour pour utiliser responsePayload');
  }
  
  const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT1_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData || null
  });
  
  if (updateResp.status === 200 || updateResp.status === 201) {
    console.log('\n✅ Agent 1 configuré!\n');
  } else {
    console.log('\n❌ Erreur PUT:', updateResp.status);
    console.log('Message:', JSON.stringify(updateResp.body).substring(0, 300));
  }
}

fixAgent1Final().catch((e) => console.error('Error:', e.message));
