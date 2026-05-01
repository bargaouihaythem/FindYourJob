const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const WORKFLOW_ID = 'abHc50O9XFYNXIa8';

// SMTP credential ID
const SMTP_CRED_ID = 'IfwIPrT1KMjf4UMR';

// Le code JS exécuté dans n8n pour scorer le CV et générer les 3 emails
const scoreIaCode = [
  'const data = $input.first().json.body || $input.first().json;',
  'const candidateId = data.candidateId || data.candidatId;',
  "const firstName   = data.prenom     || data.firstName  || 'Candidat';",
  "const lastName    = data.nom        || data.lastName   || '';",
  'const email       = data.email;',
  "const cvContent   = data.cvContent  || data.cv || '';",
  "const offreTitre  = data.offreTitre || 'le poste';",
  '',
  'function scoreCV(content) {',
  '  let score = 40;',
  "  const c = (content || '').toLowerCase();",
  "  const keywords = ['javascript','typescript','angular','react','vue','node','spring','java','python','sql','docker','git','agile','scrum','rest','api'];",
  '  const found = keywords.filter(k => c.includes(k));',
  '  score += Math.min(found.length * 3, 30);',
  '  if (c.length > 500)  score += 10;',
  '  if (c.length > 1500) score += 10;',
  "  if (c.includes('experience') || c.includes('exp\u00e9rience')) score += 5;",
  "  if (c.includes('formation') || c.includes('dipl\u00f4me') || c.includes('master') || c.includes('licence')) score += 5;",
  '  return Math.min(score, 100);',
  '}',
  '',
  'const score = scoreCV(cvContent);',
  '',
  "const css = '<style>' +",
  "  'body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}' +",
  "  '.hdr{color:white;padding:28px 20px;text-align:center;border-radius:8px 8px 0 0}' +",
  "  '.hdr h1{margin:0 0 6px;font-size:22px}' +",
  "  '.hdr p{margin:0;opacity:.9;font-size:14px}' +",
  "  '.cnt{background:#fff;padding:30px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 8px 8px}' +",
  "  '.step{display:flex;align-items:flex-start;margin:12px 0;padding:14px;background:#f8f9fa;border-radius:6px;border-left:4px solid #1a73e8}' +",
  "  '.num{background:#1a73e8;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0;margin-right:12px;font-size:12px}' +",
  "  '.badge{display:inline-block;padding:6px 20px;border-radius:20px;color:white;font-weight:600;font-size:14px;margin:12px 0}' +",
  "  '.box{background:#f8f9fa;border-radius:8px;padding:18px;margin:16px 0}' +",
  "  '.divider{border:none;border-top:1px solid #e8eaed;margin:22px 0}' +",
  "  '.ftr{text-align:center;margin-top:20px;color:#80868b;font-size:12px}' +",
  "  '</style>';",
  '',
  "const receiptHtml =",
  "  '<!DOCTYPE html><html><head><meta charset=\"UTF-8\">' + css + '</head><body>' +",
  "  '<div class=\"hdr\" style=\"background:#1a73e8\"><h1>\uD83D\uDCE7 Candidature re\u00e7ue</h1><p>' + offreTitre + '</p></div>' +",
  "  '<div class=\"cnt\">' +",
  "  '<p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p>' +",
  "  '<p>Nous accusons bonne r\u00e9ception de votre candidature pour le poste :</p>' +",
  "  '<p style=\"text-align:center;font-size:17px;font-weight:600;color:#1a73e8;margin:18px 0\">' + offreTitre + '</p>' +",
  "  '<div class=\"box\"><p style=\"margin:0\">\uD83D\uDD0D Votre dossier est en cours d\\'analyse. Vous recevrez un retour tr\u00e8s prochainement.</p></div>' +",
  "  '<hr class=\"divider\">' +",
  "  '<p style=\"color:#80868b;font-size:13px\">Si vous n\\'êtes pas à l\\'origine de cette candidature, veuillez ignorer cet email.</p>' +",
  "  '<p>Cordialement,<br><strong>L\\'équipe de recrutement JOB4YOU</strong></p>' +",
  "  '</div><div class=\"ftr\"><p>JOB4YOU \u2014 Plateforme de recrutement intelligente</p></div>' +",
  "  '</body></html>';",
  '',
  "const goodProfileHtml =",
  "  '<!DOCTYPE html><html><head><meta charset=\"UTF-8\">' + css + '</head><body>' +",
  "  '<div class=\"hdr\" style=\"background:#34a853\"><h1>\uD83C\uDF1F Excellente candidature !</h1><p>' + offreTitre + '</p></div>' +",
  "  '<div class=\"cnt\">' +",
  "  '<p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p>' +",
  "  '<p>Nous avons bien re\u00e7u votre candidature pour le poste :</p>' +",
  "  '<p style=\"text-align:center;font-size:17px;font-weight:600;color:#34a853;margin:18px 0\">' + offreTitre + '</p>' +",
  "  '<div style=\"text-align:center\"><span class=\"badge\" style=\"background:#34a853\">\uD83C\uDF1F Excellent profil</span></div>' +",
  "  '<div class=\"box\">' +",
  "  '<p style=\"margin:0 0 8px;font-weight:600\">\u2705 Votre profil est excellent !</p>' +",
  "  '<p style=\"margin:0\">Votre dossier a \u00e9t\u00e9 transmis \u00e0 notre \u00e9quipe pour examen approfondi. Nous allons \u00e9tudier votre candidature avec la plus grande attention.</p>' +",
  "  '</div>' +",
  "  '<hr class=\"divider\">' +",
  "  '<p><strong>Prochaines \u00e9tapes :</strong></p>' +",
  "  '<div class=\"step\"><div class=\"num\">1</div><div>Examen de votre dossier par notre \u00e9quipe RH.</div></div>' +",
  "  '<div class=\"step\"><div class=\"num\">2</div><div>Si votre profil est retenu, vous serez contact\u00e9(e) pour un entretien t\u00e9l\u00e9phonique.</div></div>' +",
  "  '<div class=\"step\"><div class=\"num\">3</div><div>Un retour d\u00e9finitif vous sera communiqu\u00e9 dans les meilleurs d\u00e9lais.</div></div>' +",
  "  '<hr class=\"divider\">' +",
  "  '<p>Nous vous remercions pour l\\'int\u00e9r\u00eat que vous portez \u00e0 notre entreprise.</p>' +",
  "  '<p>Cordialement,<br><strong>L\\'équipe de recrutement JOB4YOU</strong></p>' +",
  "  '</div><div class=\"ftr\"><p>JOB4YOU \u2014 Plateforme de recrutement intelligente</p></div>' +",
  "  '</body></html>';",
  '',
  "const badProfileHtml =",
  "  '<!DOCTYPE html><html><head><meta charset=\"UTF-8\">' + css + '</head><body>' +",
  "  '<div class=\"hdr\" style=\"background:#5f6368\"><h1>R\u00e9sultat de votre candidature</h1><p>' + offreTitre + '</p></div>' +",
  "  '<div class=\"cnt\">' +",
  "  '<p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p>' +",
  "  '<p>Nous vous remercions de l\\'int\u00e9r\u00eat que vous portez au poste :</p>' +",
  "  '<p style=\"text-align:center;font-size:17px;font-weight:600;color:#5f6368;margin:18px 0\">' + offreTitre + '</p>' +",
  "  '<div class=\"box\">' +",
  "  '<p style=\"margin:0 0 8px\">Apr\u00e8s analyse de votre dossier, nous avons le regret de vous informer que votre profil ne correspond pas aux crit\u00e8res requis pour ce poste \u00e0 ce stade.</p>' +",
  "  '<p style=\"margin:0;color:#80868b;font-size:13px\">Cette d\u00e9cision ne remet pas en cause vos comp\u00e9tences. Elle refl\u00e8te simplement l\\'ad\u00e9quation avec les besoins sp\u00e9cifiques du poste.</p>' +",
  "  '</div>' +",
  "  '<hr class=\"divider\">' +",
  "  '<p>Nous conservons votre CV et n\\'h\u00e9siterons pas \u00e0 vous recontacter si une opportunit\u00e9 correspondant mieux \u00e0 votre profil se pr\u00e9sente.</p>' +",
  "  '<p>Nous vous souhaitons plein succ\u00e8s dans vos recherches.</p>' +",
  "  '<p>Cordialement,<br><strong>L\\'équipe de recrutement JOB4YOU</strong></p>' +",
  "  '</div><div class=\"ftr\"><p>JOB4YOU \u2014 Plateforme de recrutement intelligente</p></div>' +",
  "  '</body></html>';",
  '',
  'return [{ json: { candidateId, firstName, lastName, email, offreTitre, score, receiptHtml, goodProfileHtml, badProfileHtml } }];'
].join('\n');

const emailNode = (id, name, position, toExpr, subjectExpr, htmlExpr) => ({
  id,
  name,
  type: 'n8n-nodes-base.emailSend',
  typeVersion: 2.1,
  position,
  parameters: {
    fromEmail: 'noreply@job4you.com',
    toEmail: toExpr,
    subject: subjectExpr,
    emailType: 'html',
    html: htmlExpr
  },
  credentials: { smtp: { id: SMTP_CRED_ID, name: 'SMTP account' } }
});

const SCORE_NODE = 'Score IA \u2014 Analyse CV';

const payload = {
  name: 'Agent 1 \u2014 CV Parser + Score IA + Emails',
  nodes: [
    // 1. Webhook
    {
      id: 'webhook-agent1',
      name: 'Webhook \u2014 Nouvelle candidature',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'agent1-cv-parser',
        responseMode: 'responseNode',
        options: {},
        webhookId: 'agent1-cv-parser'
      }
    },
    // 2. Score IA
    {
      id: 'score-ia',
      name: SCORE_NODE,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 300],
      parameters: { jsCode: scoreIaCode }
    },
    // 3. Email 1 : Accusé réception (toujours)
    emailNode(
      'email-receipt',
      'Email \u2014 Accus\u00e9 r\u00e9ception',
      [720, 80],
      '={{ $json.email }}',
      "={{ '\uD83D\uDCE7 Candidature re\u00e7ue \u2014 ' + $json.offreTitre }}",
      '={{ $json.receiptHtml }}'
    ),
    // 4. Sauvegarder score
    {
      id: 'save-score',
      name: 'Spring Boot \u2014 Sauvegarder score',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [720, 300],
      parameters: {
        method: 'PATCH',
        url: '=http://localhost:8080/api/candidates/{{ $json.candidateId }}/ai-score',
        sendQuery: true,
        queryParameters: { parameters: [{ name: 'score', value: '={{ $json.score }}' }] },
        options: {}
      }
    },
    // 5. IF score >= 75
    {
      id: 'check-score',
      name: 'Score suffisant ? (\u226575)',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [720, 500],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{
            id: 'cond-score',
            leftValue: '={{ $json.score }}',
            rightValue: 75,
            operator: { type: 'number', operation: 'gte' }
          }],
          combinator: 'and'
        }
      }
    },
    // 6a. PATCH CV_REVIEWED
    {
      id: 'auto-cv-reviewed',
      name: 'Spring Boot \u2014 Auto CV_REVIEWED',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [960, 380],
      parameters: {
        method: 'PATCH',
        url: '=http://localhost:8080/api/candidates/{{ $json.candidateId }}/status',
        sendQuery: true,
        queryParameters: { parameters: [{ name: 'status', value: 'CV_REVIEWED' }] },
        options: {}
      }
    },
    // 6b. PATCH REJECTED
    {
      id: 'auto-rejected',
      name: 'Spring Boot \u2014 Auto REJECTED',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [960, 620],
      parameters: {
        method: 'PATCH',
        url: '=http://localhost:8080/api/candidates/{{ $json.candidateId }}/status',
        sendQuery: true,
        queryParameters: { parameters: [{ name: 'status', value: 'REJECTED' }] },
        options: {}
      }
    },
    // 7a. Email 2a : Excellent profil
    emailNode(
      'email-good',
      'Email \u2014 Excellent profil',
      [1180, 380],
      "={{ $('" + SCORE_NODE + "').first().json.email }}",
      "={{ '\uD83C\uDF1F Votre profil a retenu notre attention \u2014 ' + $('" + SCORE_NODE + "').first().json.offreTitre }}",
      "={{ $('" + SCORE_NODE + "').first().json.goodProfileHtml }}"
    ),
    // 7b. Email 2b : Profil insuffisant
    emailNode(
      'email-bad',
      'Email \u2014 Profil insuffisant',
      [1180, 620],
      "={{ $('" + SCORE_NODE + "').first().json.email }}",
      "={{ 'R\u00e9sultat de votre candidature \u2014 ' + $('" + SCORE_NODE + "').first().json.offreTitre }}",
      "={{ $('" + SCORE_NODE + "').first().json.badProfileHtml }}"
    ),
    // 8. Réponse webhook
    {
      id: 'response',
      name: 'R\u00e9ponse webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1400, 500],
      parameters: {
        respondWith: 'json',
        responseBody: "={{ { ok: true, score: $('" + SCORE_NODE + "').first().json.score, candidateId: $('" + SCORE_NODE + "').first().json.candidateId } }}"
      }
    }
  ],
  connections: {
    'Webhook \u2014 Nouvelle candidature': {
      main: [[{ node: SCORE_NODE, type: 'main', index: 0 }]]
    },
    [SCORE_NODE]: {
      main: [[
        { node: 'Email \u2014 Accus\u00e9 r\u00e9ception',        type: 'main', index: 0 },
        { node: 'Spring Boot \u2014 Sauvegarder score', type: 'main', index: 0 },
        { node: 'Score suffisant ? (\u226575)',          type: 'main', index: 0 }
      ]]
    },
    'Score suffisant ? (\u226575)': {
      main: [
        [{ node: 'Spring Boot \u2014 Auto CV_REVIEWED', type: 'main', index: 0 }],
        [{ node: 'Spring Boot \u2014 Auto REJECTED',    type: 'main', index: 0 }]
      ]
    },
    'Spring Boot \u2014 Auto CV_REVIEWED': {
      main: [[{ node: 'Email \u2014 Excellent profil', type: 'main', index: 0 }]]
    },
    'Email \u2014 Excellent profil': {
      main: [[{ node: 'R\u00e9ponse webhook', type: 'main', index: 0 }]]
    },
    'Spring Boot \u2014 Auto REJECTED': {
      main: [[{ node: 'Email \u2014 Profil insuffisant', type: 'main', index: 0 }]]
    },
    'Email \u2014 Profil insuffisant': {
      main: [[{ node: 'R\u00e9ponse webhook', type: 'main', index: 0 }]]
    }
  },
  settings: { executionOrder: 'v1' }
};

const body = JSON.stringify(payload);
const options = {
  hostname: 'localhost',
  port: 5678,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': API_KEY,
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('Agent 1 mis a jour avec succes!');
    } else {
      console.log('Erreur HTTP', res.statusCode, data.substring(0, 500));
    }
  });
});
req.on('error', e => console.error('Erreur:', e.message));
req.write(body);
req.end();