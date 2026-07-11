const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = http.request({ hostname: 'localhost', port: 8080, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(raw) }); }
        catch { resolve({ s: res.statusCode, b: raw }); }
      });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const login = await req('POST', '/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  const token = login.b && login.b.token;
  const cand = await req('GET', '/api/candidates/31', null, token);
  console.log(JSON.stringify(cand, null, 2));
})();
