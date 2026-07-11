const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const AGENT1_ID = 'abHc50O9XFYNXIa8';
const AGENT3_ID = 'aDlMEwef9SLGf0Xd';

function httpRequest(method, urlPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY
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
    req.end();
  });
}

async function checkResponseNodes() {
  console.log('=== CHECKING AGENT WORKFLOWS ===\n');
  
  for (const [workflowId, name] of [[AGENT1_ID, 'Agent 1'], [AGENT3_ID, 'Agent 3']]) {
    const resp = await httpRequest('GET', '/api/v1/workflows/' + workflowId);
    if (resp.status !== 200) {
      console.log('[' + name + '] ❌ Error fetching workflow');
      continue;
    }
    
    const workflow = resp.body;
    const responseNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.respondToWebhook');
    
    console.log('[' + name + ']');
    if (!responseNode) {
      console.log('  ❌ No response node');
    } else {
      console.log('  Name: ' + responseNode.name);
      console.log('  ResponseBody:');
      const body = responseNode.parameters.responseBody;
      console.log('    ' + (body ? body.substring(0, 200) : '(empty)'));
    }
    console.log('');
  }
}

checkResponseNodes().catch((e) => console.error('Error:', e.message));
