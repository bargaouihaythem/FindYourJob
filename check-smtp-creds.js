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
  console.log('=== CREDENTIALS SMTP DISPONIBLES ===\n');
  
  const resp = await httpRequest('GET', '/api/v1/credentials?filter={"type":"smtp"}');
  
  if (resp.status === 200 && resp.body.data) {
    if (resp.body.data.length === 0) {
      console.log('❌ Aucun credential SMTP trouvé');
      console.log('\nVous devez configurer SMTP dans n8n:');
      console.log('1. Ouvrez http://localhost:5678');
      console.log('2. Admin > Credentials');
      console.log('3. New credential > SMTP');
      console.log('4. Remplissez: Host, Port, User, Password');
      console.log('5. Test & Save');
    } else {
      console.log('✅ Credentials SMTP trouvés:');
      resp.body.data.forEach(cred => {
        console.log('  - ' + cred.name + ' (ID: ' + cred.id + ')');
      });
    }
  } else {
    console.log('Erreur API:', resp.status, resp.body);
  }
}

main().catch((e) => console.error('Erreur:', e.message));
