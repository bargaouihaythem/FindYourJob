const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const AGENT1_ID = 'abHc50O9XFYNXIa8';
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

async function fixBothAgents() {
  console.log('=== SIMPLIFIED RESPONSE BODIES ===\n');
  
  // Agent 1
  {
    const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT1_ID);
    if (getResp.status === 200) {
      const workflow = getResp.body;
      const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
      
      if (responseNode) {
        // Simple JSON object as string
        responseNode.parameters.responseBody = '={"status":"ok","score":$("Score IA — Analyse CV").first().json.score}';
        
        const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT1_ID, {
          name: workflow.name,
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings,
          staticData: workflow.staticData || null
        });
        
        console.log('[Agent 1] ' + (updateResp.status === 200 || updateResp.status === 201 ? '✅' : '❌') + ' Status: ' + updateResp.status);
      }
    }
  }
  
  // Agent 3
  {
    const getResp = await httpRequest('GET', '/api/v1/workflows/' + AGENT3_ID);
    if (getResp.status === 200) {
      const workflow = getResp.body;
      const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
      
      if (responseNode) {
        // Simple JSON object as string
        responseNode.parameters.responseBody = '={"status":"ok","message":"Interview scheduled"}';
        
        const updateResp = await httpRequest('PUT', '/api/v1/workflows/' + AGENT3_ID, {
          name: workflow.name,
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings,
          staticData: workflow.staticData || null
        });
        
        console.log('[Agent 3] ' + (updateResp.status === 200 || updateResp.status === 201 ? '✅' : '❌') + ' Status: ' + updateResp.status);
      }
    }
  }
}

fixBothAgents().catch((e) => console.error('Error:', e.message));
