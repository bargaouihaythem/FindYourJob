const http = require('http');
const fs = require('fs');

const N8N_COOKIE = 'n8n-auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgzNjU5ZGYxLWQ4MzItNDk3OS05NjNmLWQ5OWUyNWYzM2RmYyIsImhhc2giOiI2M2FkY2RtNlVQIiwidXNlZE1mYSI6ZmFsc2UsImlhdCI6MTc4MjA3NDkxNCwiZXhwIjoxNzgyNjc5NzE0fQ.NV4fvtN5ZZY0J5U1piGql60sRAHDoEM5Ar_uJ4NYF60';
const WORKFLOW_ID = 'abHc50O9XFYNXIa8';
const GROQ_KEY = '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';
const CODE_NODE_NAME = 'Score IA \u2014 Analyse CV';

function n8nRequest(method, path, body) {
  return new Promise(function(resolve) {
    const d = body ? JSON.stringify(body) : null;
    const headers = { 'Cookie': N8N_COOKIE, 'Content-Type': 'application/json' };
    if (d) headers['Content-Length'] = Buffer.byteLength(d);
    const opts = { hostname: 'localhost', port: 5678, path: path, method: method, headers: headers };
    const req = http.request(opts, function(resp) {
      let raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() {
        try { resolve({ s: resp.statusCode, b: JSON.parse(raw) }); }
        catch(e) { resolve({ s: resp.statusCode, b: raw }); }
      });
    });
    req.on('error', function(e) { resolve({ s: 0, b: e.message }); });
    if (d) req.write(d);
    req.end();
  });
}

// Code complet: Groq LLM + génération HTML emails
const NEW_CODE = `
const data = $input.first().json.body || $input.first().json;
const candidateId = data.candidateId || data.candidatId;
const firstName   = data.prenom  || data.firstName  || 'Candidat';
const lastName    = data.nom     || data.lastName   || '';
const email       = data.email;
const cvContent   = data.cvContent || data.cv || '';
const offreTitre  = data.offreTitre || 'le poste';

const GROQ_KEY = '${GROQ_KEY}';

// ──────────────────────────────────────────
// ANALYSE IA VIA GROQ (Llama 3.1)
// ──────────────────────────────────────────
const prompt = \`Tu es un expert RH. Analyse ce CV pour le poste "\${offreTitre}".

CV du candidat:
\${cvContent || 'Aucun contenu CV fourni'}

Reponds UNIQUEMENT en JSON valide, sans aucun texte avant ou apres:
{"score": 75, "summary": "2 phrases max en francais.", "recommendation": "HIRE"}

Regles:
- score: 0-100 selon adequation competences/poste
- summary: bilan professionnel en francais, 2 phrases maximum
- recommendation: "HIRE" si score>=70, "MAYBE" si 40-69, "REJECT" si <40\`;

let score = 40;
let summary = 'Analyse automatique du CV';
let recommendation = 'MAYBE';
let analyzedBy = 'Fallback (mots-cles)';

try {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + GROQ_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Expert RH. Reponds UNIQUEMENT en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  });
  const result = await resp.json();
  const content = result.choices[0].message.content.trim();
  const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    score = Math.max(0, Math.min(100, parseInt(parsed.score) || 40));
    summary = parsed.summary || 'Analyse IA completee';
    recommendation = ['HIRE', 'MAYBE', 'REJECT'].includes(parsed.recommendation)
      ? parsed.recommendation
      : (score >= 70 ? 'HIRE' : score >= 40 ? 'MAYBE' : 'REJECT');
    analyzedBy = 'Groq llama-3.1-8b-instant';
  }
} catch (err) {
  const c = (cvContent || '').toLowerCase();
  const kw = ['javascript','typescript','angular','react','vue','node','spring','java',
              'python','sql','docker','git','agile','scrum','rest','api','microservices','kubernetes'];
  const found = kw.filter(k => c.includes(k));
  score = Math.min(40 + found.length * 4 + (c.length > 500 ? 10 : 0) + (c.length > 1500 ? 10 : 0), 100);
  summary = 'Analyse par mots-cles (Groq: ' + err.message.substring(0, 50) + ')';
  recommendation = score >= 70 ? 'HIRE' : score >= 40 ? 'MAYBE' : 'REJECT';
}

// ──────────────────────────────────────────
// GENERATION HTML EMAILS
// ──────────────────────────────────────────
const scoreColor = score >= 75 ? '#27ae60' : score >= 50 ? '#f39c12' : '#e74c3c';
const css = '<style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333}.hdr{background:#1a3c6e;color:white;padding:24px;border-radius:8px 8px 0 0;text-align:center}.score-box{background:#f8f9fa;border:2px solid ' + scoreColor + ';border-radius:8px;padding:16px;margin:16px 0;text-align:center}.score-val{font-size:48px;font-weight:bold;color:' + scoreColor + '}.reco{display:inline-block;padding:6px 16px;border-radius:20px;font-weight:bold;color:white;background:' + scoreColor + '}.footer{margin-top:20px;font-size:12px;color:#999;text-align:center}</style>';

const receiptHtml = css + '<div class="hdr"><h1>Candidature reçue</h1><p>' + offreTitre + '</p></div><div style="padding:20px"><p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p><p>Nous avons bien reçu votre candidature. Notre IA analyse votre profil.</p><div class="score-box"><div class="score-val">' + score + '/100</div><p>' + summary + '</p><span class="reco">' + recommendation + '</span></div><div class="footer">Analysé par ' + analyzedBy + '</div></div>';

const goodProfileHtml = css + '<div class="hdr" style="background:#27ae60"><h1>Profil retenu !</h1><p>' + offreTitre + '</p></div><div style="padding:20px"><p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p><p>Votre profil a été sélectionné pour la prochaine étape du processus de recrutement.</p><div class="score-box"><div class="score-val">' + score + '/100</div><p>' + summary + '</p></div></div>';

const badProfileHtml = css + '<div class="hdr" style="background:#c0392b"><h1>Suite de candidature</h1><p>' + offreTitre + '</p></div><div style="padding:20px"><p>Bonjour <strong>' + firstName + ' ' + lastName + '</strong>,</p><p>Après examen de votre candidature, nous ne donnons pas suite. Merci de votre intérêt.</p><div class="score-box"><div class="score-val">' + score + '/100</div><p>' + summary + '</p></div></div>';

return [{
  json: {
    candidateId, firstName, lastName, email, offreTitre,
    score, summary, recommendation, analyzedBy,
    cvContent, receiptHtml, goodProfileHtml, badProfileHtml
  }
}];
`.trim();

async function main() {
  console.log('[1] Récupération du workflow...');
  const wfResp = await n8nRequest('GET', '/rest/workflows/' + WORKFLOW_ID);
  const workflow = wfResp.b.data;
  console.log('    "' + workflow.name + '" (' + workflow.nodes.length + ' noeuds)');

  // [2] Mettre à jour le Code node
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.code' && node.name.indexOf('Score') !== -1) {
      node.parameters.jsCode = NEW_CODE;
      node.name = CODE_NODE_NAME; // garder le nom original pour les connexions
      console.log('[2] Code node mis à jour: ' + node.name);
    }

    // [3] Configurer Réponse webhook — référencer le Code node par son nom
    if (node.type === 'n8n-nodes-base.respondToWebhook') {
      node.parameters = {
        respondWith: 'json',
        responseBody: "={{ { ok: true, score: $('" + CODE_NODE_NAME + "').first().json.score, summary: $('" + CODE_NODE_NAME + "').first().json.summary, recommendation: $('" + CODE_NODE_NAME + "').first().json.recommendation, candidateId: $('" + CODE_NODE_NAME + "').first().json.candidateId, analyzedBy: $('" + CODE_NODE_NAME + "').first().json.analyzedBy } }}"
      };
      console.log('[3] Réponse webhook configurée avec référence au Code node');
    }
  });

  // [4] Restaurer les connexions originales (Email → Réponse webhook) et supprimer Code direct → Réponse
  const RESP_NODE = 'R\u00e9ponse webhook';
  // Supprimer la connexion directe Code → Réponse webhook
  if (workflow.connections[CODE_NODE_NAME]) {
    workflow.connections[CODE_NODE_NAME].main[0] = workflow.connections[CODE_NODE_NAME].main[0].filter(
      function(c) { return c.node !== RESP_NODE; }
    );
  }
  // Restaurer Email Excellent → Réponse webhook
  if (workflow.connections['Email \u2014 Excellent profil']) {
    const alreadyHas = workflow.connections['Email \u2014 Excellent profil'].main[0].some(
      function(c) { return c.node === RESP_NODE; }
    );
    if (!alreadyHas) {
      workflow.connections['Email \u2014 Excellent profil'].main[0].push({ node: RESP_NODE, type: 'main', index: 0 });
    }
  }
  // Restaurer Email Profil insuffisant → Réponse webhook
  if (workflow.connections['Email \u2014 Profil insuffisant']) {
    const alreadyHas2 = workflow.connections['Email \u2014 Profil insuffisant'].main[0].some(
      function(c) { return c.node === RESP_NODE; }
    );
    if (!alreadyHas2) {
      workflow.connections['Email \u2014 Profil insuffisant'].main[0].push({ node: RESP_NODE, type: 'main', index: 0 });
    }
  }
  console.log('[4] Connexions restaurées');

  // [5] Sauvegarder
  console.log('[5] Sauvegarde...');
  const saveResp = await n8nRequest('PATCH', '/rest/workflows/' + WORKFLOW_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });

  if (saveResp.s === 200) {
    console.log('\n===================================================');
    console.log(' Agent 1 - Intégration Groq COMPLETE !');
    console.log(' Modèle: llama-3.1-8b-instant');
    console.log(' Champs retournés: score, summary, recommendation, analyzedBy');
    console.log(' Emails HTML: receiptHtml, goodProfileHtml, badProfileHtml');
    console.log('===================================================');
  } else {
    console.log('Erreur: ' + JSON.stringify(saveResp.b).substring(0, 300));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
