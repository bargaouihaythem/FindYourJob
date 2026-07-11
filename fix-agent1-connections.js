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

  const RESP_NODE = 'R\u00e9ponse webhook';
  const CODE_NODE = 'Score IA \u2014 Analyse CV';

  console.log('Connexions avant modification:');
  Object.keys(workflow.connections).forEach(function(name) {
    const conns = workflow.connections[name].main || [];
    conns.forEach(function(outputs, idx) {
      outputs.forEach(function(c) {
        if (c.node === RESP_NODE) {
          console.log('  ' + name + ' -> Reponse webhook');
        }
      });
    });
  });

  // Supprimer TOUTES les connexions vers Réponse webhook sauf depuis le Code node
  Object.keys(workflow.connections).forEach(function(name) {
    if (name === CODE_NODE) return; // garder celle du Code node
    const conns = workflow.connections[name];
    if (!conns || !conns.main) return;
    conns.main.forEach(function(outputs, idx) {
      conns.main[idx] = outputs.filter(function(c) {
        return c.node !== RESP_NODE;
      });
    });
  });

  // S'assurer que Code node → Réponse webhook existe
  if (!workflow.connections[CODE_NODE]) {
    workflow.connections[CODE_NODE] = { main: [[]] };
  }
  const codeOutputs = workflow.connections[CODE_NODE].main[0];
  const hasResp = codeOutputs.some(function(c) { return c.node === RESP_NODE; });
  if (!hasResp) {
    codeOutputs.push({ node: RESP_NODE, type: 'main', index: 0 });
    console.log('Connexion Code -> Réponse webhook ajoutée');
  } else {
    console.log('Connexion Code -> Réponse webhook: déjà présente');
  }

  // Configurer Réponse webhook avec $json simple (input direct du Code node)
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.respondToWebhook') {
      node.parameters = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, score: $json.score, summary: $json.summary, recommendation: $json.recommendation, candidateId: $json.candidateId, analyzedBy: $json.analyzedBy }) }}'
      };
    }
  });

  const saveResp = await n8nRequest('PATCH', '/rest/workflows/' + WORKFLOW_ID, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });

  if (saveResp.s === 200) {
    console.log('\nConnexions après:');
    const saved = saveResp.b.data;
    Object.keys(saved.connections).forEach(function(name) {
      const conns = saved.connections[name].main || [];
      conns.forEach(function(outputs) {
        outputs.forEach(function(c) {
          if (c.node === RESP_NODE) console.log('  ' + name + ' -> Reponse webhook');
        });
      });
    });
    console.log('\nWorkflow mis a jour avec succes !');
  } else {
    console.log('Erreur: ' + saveResp.s + ' ' + JSON.stringify(saveResp.b).substring(0, 200));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
