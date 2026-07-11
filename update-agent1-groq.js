const http = require('http');
const https = require('https');

const GROQ_KEY = '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';
const N8N_COOKIE = 'n8n-auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgzNjU5ZGYxLWQ4MzItNDk3OS05NjNmLWQ5OWUyNWYzM2RmYyIsImhhc2giOiI2M2FkY2RtNlVQIiwidXNlZE1mYSI6ZmFsc2UsImlhdCI6MTc4MjA3NDkxNCwiZXhwIjoxNzgyNjc5NzE0fQ.NV4fvtN5ZZY0J5U1piGql60sRAHDoEM5Ar_uJ4NYF60';
const WORKFLOW_ID = 'abHc50O9XFYNXIa8';

// Le nouveau code JavaScript du noeud "Score IA" - analyse via Groq LLM
const NEW_CODE = `
const data = $input.first().json.body || $input.first().json;
const candidateId = data.candidateId || data.candidatId;
const firstName   = data.prenom  || data.firstName  || 'Candidat';
const lastName    = data.nom     || data.lastName   || '';
const email       = data.email;
const cvContent   = data.cvContent || data.cv || '';
const offreTitre  = data.offreTitre || 'le poste';

const GROQ_KEY = '${GROQ_KEY}';

const prompt = \`Tu es un expert RH senior. Analyse ce CV pour le poste "\${offreTitre}".

CV du candidat:
\${cvContent || 'Aucun contenu CV disponible - candidature sans CV joint'}

Reponds UNIQUEMENT en JSON valide exactement comme ceci (sans texte avant ou apres):
{"score": 75, "summary": "Resume professionnel en 2 phrases.", "recommendation": "HIRE"}

Regles de scoring:
- score: entier 0-100 selon adequation competences/experience au poste
- summary: bilan RH en francais, 2 phrases maximum
- recommendation: exactement "HIRE" si score>=70, "MAYBE" si score 40-69, "REJECT" si score<40\`;

let score = 40;
let summary = 'Analyse automatique du CV';
let recommendation = 'MAYBE';

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
        { role: 'system', content: 'Tu es un expert RH. Reponds uniquement en JSON valide, sans aucun texte supplementaire.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  const result = await resp.json();
  const content = result.choices[0].message.content.trim();

  // Extraire le JSON de la reponse LLM
  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    score = Math.max(0, Math.min(100, parseInt(parsed.score) || 40));
    summary = parsed.summary || 'Analyse IA completee';
    recommendation = ['HIRE', 'MAYBE', 'REJECT'].includes(parsed.recommendation)
      ? parsed.recommendation
      : (score >= 70 ? 'HIRE' : score >= 40 ? 'MAYBE' : 'REJECT');
  }
} catch (err) {
  // Fallback scoring par mots-cles si Groq indisponible
  const c = (cvContent || '').toLowerCase();
  const keywords = ['javascript', 'typescript', 'angular', 'react', 'vue', 'node',
                    'spring', 'java', 'python', 'sql', 'docker', 'git', 'agile',
                    'scrum', 'rest', 'api', 'microservices', 'kubernetes'];
  const found = keywords.filter(k => c.includes(k));
  score = Math.min(40 + found.length * 4 + (c.length > 500 ? 10 : 0) + (c.length > 1500 ? 10 : 0), 100);
  summary = 'Analyse par mots-cles (Groq indisponible: ' + err.message + ')';
  recommendation = score >= 70 ? 'HIRE' : score >= 40 ? 'MAYBE' : 'REJECT';
}

return [{
  json: {
    candidateId,
    firstName,
    lastName,
    email,
    offreTitre,
    score,
    summary,
    recommendation,
    cvContent,
    analyzedBy: 'Groq llama-3.1-8b-instant'
  }
}];
`.trim();

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

function groqTest() {
  return new Promise(function(resolve) {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Reponds uniquement: {"score":85,"summary":"Profil Java solide avec 5 ans experience Spring Boot.","recommendation":"HIRE"}' }],
      temperature: 0.1,
      max_tokens: 100
    });
    const opts = {
      hostname: 'api.groq.com', port: 443, path: '/openai/v1/chat/completions', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, function(resp) {
      let raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() {
        try { resolve({ s: resp.statusCode, b: JSON.parse(raw) }); }
        catch(e) { resolve({ s: resp.statusCode, b: raw }); }
      });
    });
    req.on('error', function(e) { resolve({ s: 0, b: e.message }); });
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Test Groq
  console.log('[1] Test connexion Groq...');
  const test = await groqTest();
  if (test.s !== 200) {
    console.log('ERREUR Groq: ' + JSON.stringify(test.b).substring(0, 200));
    return;
  }
  const testContent = test.b.choices[0].message.content;
  console.log('    Groq OK! Reponse: ' + testContent);

  // 2. Recuperer le workflow Agent 1
  console.log('[2] Recuperation workflow Agent 1...');
  const wfResp = await n8nRequest('GET', '/rest/workflows/' + WORKFLOW_ID);
  if (wfResp.s !== 200) {
    console.log('ERREUR recuperation: ' + JSON.stringify(wfResp.b).substring(0, 200));
    return;
  }
  const workflow = wfResp.b.data;
  console.log('    Workflow: "' + workflow.name + '" (' + workflow.nodes.length + ' noeuds)');

  // 3. Mettre a jour le noeud Score IA
  console.log('[3] Mise a jour noeud Score IA...');
  let updated = false;
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.code' && node.name.indexOf('Score') !== -1) {
      console.log('    Noeud trouve: "' + node.name + '"');
      node.parameters.jsCode = NEW_CODE;
      node.name = 'Score IA — Groq Llama3 (LLM reel)';
      updated = true;
    }
  });

  if (!updated) {
    console.log('ERREUR: noeud "Score IA" non trouve dans le workflow');
    return;
  }

  // 4. Sauvegarder le workflow mis a jour
  console.log('[4] Sauvegarde du workflow...');
  const saveResp = await n8nRequest('PATCH', '/rest/workflows/' + WORKFLOW_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });

  if (saveResp.s === 200) {
    console.log('\n===================================================');
    console.log('Agent 1 mis a jour avec succes !');
    console.log('Modele: Groq llama-3.1-8b-instant');
    console.log('Noeud: "Score IA — Groq Llama3 (LLM reel)"');
    console.log('===================================================');
  } else {
    console.log('ERREUR sauvegarde: status=' + saveResp.s);
    console.log(JSON.stringify(saveResp.b).substring(0, 300));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
