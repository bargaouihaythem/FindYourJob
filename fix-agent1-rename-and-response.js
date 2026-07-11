const http = require('http');
const fs = require('fs');

const N8N_COOKIE = 'n8n-auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgzNjU5ZGYxLWQ4MzItNDk3OS05NjNmLWQ5OWUyNWYzM2RmYyIsImhhc2giOiI2M2FkY2RtNlVQIiwidXNlZE1mYSI6ZmFsc2UsImlhdCI6MTc4MjA3NDkxNCwiZXhwIjoxNzgyNjc5NzE0fQ.NV4fvtN5ZZY0J5U1piGql60sRAHDoEM5Ar_uJ4NYF60';
const WORKFLOW_ID = 'abHc50O9XFYNXIa8';

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

async function main() {
  console.log('[1] Récupération du workflow...');
  const wfResp = await n8nRequest('GET', '/rest/workflows/' + WORKFLOW_ID);
  const workflow = wfResp.b.data;
  
  console.log('    Nom actuel: "' + workflow.name + '"');
  console.log('    Noeuds: ' + workflow.nodes.length);
  
  // [2] Renommer le workflow
  console.log('[2] Renommage workflow...');
  workflow.name = 'Agent 1 — CV Parser + Score IA + Emails';
  
  // [3] Corriger le nœud "Réponse webhook" pour retourner le JSON complet
  console.log('[3] Correction réponse webhook...');
  const RESP_NODE_NAME = 'Réponse webhook';
  const CODE_NODE_NAME = 'Score IA — Analyse CV';
  
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.respondToWebhook') {
      // Référencer le Code node pour extraire les champs
      node.parameters = {
        respondWith: 'json',
        responseBody: "={{ { status: 'ok', candidateId: $('" + CODE_NODE_NAME + "').first().json.candidateId, score: $('" + CODE_NODE_NAME + "').first().json.score, summary: $('" + CODE_NODE_NAME + "').first().json.summary, recommendation: $('" + CODE_NODE_NAME + "').first().json.recommendation, analyzedBy: $('" + CODE_NODE_NAME + "').first().json.analyzedBy } }}"
      };
      console.log('    Réponse webhook mise à jour');
    }
  });
  
  // [4] Vérifier les connexions (Email → Réponse webhook)
  console.log('[4] Vérification connexions...');
  // S'assurer que Email — Excellent profil → Réponse webhook existe
  if (workflow.connections['Email — Excellent profil']) {
    const hasConn = workflow.connections['Email — Excellent profil'].main[0].some(c => c.node === RESP_NODE_NAME);
    if (!hasConn) {
      workflow.connections['Email — Excellent profil'].main[0].push({ node: RESP_NODE_NAME, type: 'main', index: 0 });
      console.log('    Connexion Email Excellent → Réponse webhook AJOUTÉE');
    } else {
      console.log('    Connexion Email Excellent → Réponse webhook OK');
    }
  }
  
  // S'assurer que Email — Profil insuffisant → Réponse webhook existe
  if (workflow.connections['Email — Profil insuffisant']) {
    const hasConn2 = workflow.connections['Email — Profil insuffisant'].main[0].some(c => c.node === RESP_NODE_NAME);
    if (!hasConn2) {
      workflow.connections['Email — Profil insuffisant'].main[0].push({ node: RESP_NODE_NAME, type: 'main', index: 0 });
      console.log('    Connexion Email Insuffisant → Réponse webhook AJOUTÉE');
    } else {
      console.log('    Connexion Email Insuffisant → Réponse webhook OK');
    }
  }
  
  // [5] Sauvegarder
  console.log('[5] Sauvegarde du workflow...');
  const saveResp = await n8nRequest('PATCH', '/rest/workflows/' + WORKFLOW_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });
  
  if (saveResp.s === 200) {
    console.log('\n✅ RENOMMAGE COMPLETÉ');
    console.log('   Nom: Agent 1 — CV Parser + Score IA + Emails');
    console.log('   Réponse webhook: OK (avec score, summary, recommendation, analyzedBy)');
    console.log('   Connexions: Vérifiées');
    console.log('\n   -> Relancez node test-agents.js pour validation\n');
  } else {
    console.log('❌ Erreur: ' + JSON.stringify(saveResp.b).substring(0, 300));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
