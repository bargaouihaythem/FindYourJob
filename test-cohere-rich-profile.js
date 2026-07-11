const http = require('http');

function request(method, path, body, token) {
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

function applyCandidate(candidateToken, offerId, firstName, lastName, email, coverLetter) {
  const boundary = '----FormBoundary' + Date.now() + Math.floor(Math.random() * 1000);
  const appJson = JSON.stringify({ firstName, lastName, email, phone: '0600000000', address: 'Paris, France', coverLetter, jobOfferId: offerId });
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n192\n%%EOF');
  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="application"\r\n\r\n${appJson}\r\n`;
  const part2h = `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(part1), Buffer.from(part2h), pdfContent, Buffer.from(end)]);
  return new Promise((resolve) => {
    const r = http.request({
      hostname: 'localhost', port: 8080, path: '/api/candidates/apply', method: 'POST',
      headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(raw) }); }
        catch { resolve({ s: res.statusCode, b: raw }); }
      });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    r.write(body);
    r.end();
  });
}

(async () => {
  const admin = await request('POST', '/api/auth/signin', { username: 'admin', password: 'Admin2026!' });
  const adminToken = admin.b.token;
  const cand = await request('POST', '/api/auth/signin', { username: 'candidat1', password: 'Test2026!' });
  const candToken = cand.b.token;

  const richCoverLetter = "Etudiante en Master Marketing Digital, j'ai realise un stage de 6 mois en gestion de " +
    "reseaux sociaux et content marketing pour une PME. Je maitrise Google Analytics, le SEO, la creation de " +
    "contenus engageants et la gestion de campagnes sur les reseaux sociaux (Instagram, LinkedIn, TikTok). " +
    "Ma communication ecrite est soignee, creative et adaptee aux differents publics cibles. Je suis passionnee " +
    "par les strategies de communication digitale et souhaite mettre mes competences au service de votre equipe " +
    "marketing pour ce stage.";

  const ts = Date.now();
  const apply = await applyCandidate(candToken, 123, 'Sophie', 'Lemoine', `bargaouihaythem1+richprofile${ts}@gmail.com`, richCoverLetter);
  console.log('apply status:', apply.s, '| candidateId:', apply.b.id);
  const candidateId = apply.b.id;

  await new Promise((r) => setTimeout(r, 2000));

  const recompute = await request('POST', `/api/candidates/${candidateId}/ai-score/recompute`, null, adminToken);
  console.log('recompute status:', recompute.s);
  console.log(JSON.stringify({
    aiScore: recompute.b.aiScore,
    aiScoreTechnical: recompute.b.aiScoreTechnical,
    aiScoreCommunication: recompute.b.aiScoreCommunication,
    aiScoreSeniorityMatch: recompute.b.aiScoreSeniorityMatch,
    aiScoreSource: recompute.b.aiScoreSource,
    status: recompute.b.status,
  }, null, 2));
})();
