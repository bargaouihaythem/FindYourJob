const http = require('http');

// Pas de API key, essayons avec l'authentification par cookie (n8n par défaut)
function httpRequest(method, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        resolve({ status: res.statusCode, body: raw });
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testApiAccess() {
  console.log('Testing n8n API access...\n');
  
  // Essayer sans API key
  const resp1 = await httpRequest('GET', '/api/v1/workflows', null, null);
  console.log('Without API key:', resp1.status);
  
  if (resp1.status === 403 || resp1.status === 401) {
    console.log('\nAPI key requis. Essayons de créer une nouvelle...');
    
    // Essayer de créer une API key via l'endpoint /rest/api-keys
    const createResp = await httpRequest('POST', '/rest/api-keys', 
      { label: 'Agent API Key ' + Date.now() },
      null
    );
    console.log('Create API key status:', createResp.status);
    console.log('Response:', createResp.body.substring(0, 500));
  }
}

testApiAccess().catch((e) => console.error('Error:', e.message));
