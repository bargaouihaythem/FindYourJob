const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';

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

async function main() {
  console.log('=== TOUS LES CREDENTIALS ===\n');
  
  const resp = await httpRequest('GET', '/api/v1/credentials');
  
  if (resp.status === 200 && resp.body.data) {
    console.log('Total: ' + resp.body.data.length);
    const smtpCreds = resp.body.data.filter(c => c.type === 'smtp');
    
    if (smtpCreds.length === 0) {
      console.log('\n❌ Aucun credential SMTP');
      console.log('Types disponibles:');
      const types = [...new Set(resp.body.data.map(c => c.type))];
      types.forEach(t => console.log('  - ' + t));
    } else {
      console.log('\n✅ SMTP Credentials:');
      smtpCreds.forEach(c => {
        console.log('  Name: ' + c.name);
        console.log('  ID:   ' + c.id);
      });
    }
  } else {
    console.log('Erreur API:', resp.status, resp.body);
  }
}

main().catch((e) => console.error('Erreur:', e.message));
