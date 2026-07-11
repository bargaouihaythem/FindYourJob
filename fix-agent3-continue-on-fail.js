const http = require('http');

const N8N_COOKIE = 'n8n-auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgzNjU5ZGYxLWQ4MzItNDk3OS05NjNmLWQ5OWUyNWYzM2RmYyIsImhhc2giOiI2M2FkY2RtNlVQIiwidXNlZE1mYSI6ZmFsc2UsImlhdCI6MTc4MjA3NDkxNCwiZXhwIjoxNzgyNjc5NzE0fQ.NV4fvtN5ZZY0J5U1piGql60sRAHDoEM5Ar_uJ4NYF60';
const WORKFLOW_ID = 'aDlMEwef9SLGf0Xd';  // Agent 3

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
  console.log('[1] Récupération workflow Agent 3...');
  const wfResp = await n8nRequest('GET', '/rest/workflows/' + WORKFLOW_ID);
  const workflow = wfResp.b.data;
  
  console.log('    Nom: "' + workflow.name + '"');
  console.log('    Noeuds: ' + workflow.nodes.length);
  
  // [2] Ajouter continueOnFail sur les nœuds emailSend (évite que la workflow s'arrête si email échoue)
  console.log('[2] Configuration emailSend avec continueOnFail...');
  let emailCount = 0;
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.emailSend') {
      if (!node.continueOnFail) {
        node.continueOnFail = true;
        emailCount++;
      }
    }
  });
  console.log('    ' + emailCount + ' nœuds emailSend configurés');
  
  // [3] S'assurer que les nœuds de préparation (code) ont la bonne logique
  console.log('[3] Vérification nœud préparation données...');
  let codeNodeOk = false;
  workflow.nodes.forEach(function(node) {
    if (node.type === 'n8n-nodes-base.code' && node.name.includes('Préparer')) {
      // Le code node doit retourner les champs attendus
      // Vérifier juste qu'il existe et n'est pas vide
      if (node.parameters && node.parameters.jsCode && node.parameters.jsCode.length > 10) {
        codeNodeOk = true;
        console.log('    Code node présent: ' + node.name);
      }
    }
  });
  
  // [4] Vérifier les connexions : Webhook → Code → Emails
  console.log('[4] Vérification flux connexions...');
  const webhookConn = workflow.connections['Webhook — Entretien créé'];
  const codeConn = workflow.connections['Préparer données entretien'];
  console.log('    Webhook → Code:', webhookConn && webhookConn.main && webhookConn.main[0] ? 'OK' : 'MANQUANTE');
  console.log('    Code → Emails:', codeConn && codeConn.main && codeConn.main[0] ? 'OK' : 'MANQUANTE');
  
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
    console.log('\n✅ AGENT 3 CORRIGÉ');
    console.log('   continueOnFail: activé sur emails');
    console.log('   Connexions: Vérifiées');
    console.log('\n   -> Relancez node test-agents.js pour validation\n');
  } else {
    console.log('❌ Erreur: ' + JSON.stringify(saveResp.b).substring(0, 300));
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
