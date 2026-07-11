const http = require('http');
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
  const wfResp = await n8nRequest('GET', '/rest/workflows/' + WORKFLOW_ID);
  const workflow = wfResp.b.data;

  const CODE_NODE_NAME = 'Score IA \u2014 Analyse CV';

  workflow.nodes.forEach(function(node) {
    // Fixer le noeud Réponse webhook — utiliser $('Score IA...').item.json
    if (node.type === 'n8n-nodes-base.respondToWebhook') {
      // Réponse simple: retourner tous les champs du noeud Code via référence directe
      node.parameters = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, score: $json.score, summary: $json.summary, recommendation: $json.recommendation, candidateId: $json.candidateId, analyzedBy: $json.analyzedBy }) }}'
      };
      console.log('Réponse webhook configurée: ' + node.name);
    }

    // S'assurer que le noeud Code a le bon nom pour les connexions
    if (node.type === 'n8n-nodes-base.code' && node.name.indexOf('Score') !== -1) {
      node.name = CODE_NODE_NAME;
      console.log('Code node renommé: ' + node.name);
    }
  });

  // Vérifier que la connexion Code → Réponse webhook existe
  const codeConns = workflow.connections[CODE_NODE_NAME];
  if (codeConns && codeConns.main && codeConns.main[0]) {
    const hasRespConn = codeConns.main[0].some(function(c) {
      return c.node === 'R\u00e9ponse webhook';
    });
    console.log('Connexion Code → Réponse webhook: ' + (hasRespConn ? 'OK' : 'MANQUANTE - ajout'));
    if (!hasRespConn) {
      codeConns.main[0].push({ node: 'R\u00e9ponse webhook', type: 'main', index: 0 });
    }
  }

  const saveResp = await n8nRequest('PATCH', '/rest/workflows/' + WORKFLOW_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });

  if (saveResp.s === 200) {
    console.log('\n✓ Workflow mis à jour avec succès');
  } else {
    console.log('Erreur: ' + JSON.stringify(saveResp.b).substring(0, 200));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
