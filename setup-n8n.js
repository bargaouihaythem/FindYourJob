#!/usr/bin/env node
/**
 * Script d'import automatique des 3 workflows n8n
 * Usage : node setup-n8n.js
 *
 * Prérequis : n8n en cours d'exécution sur http://localhost:5678
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const N8N_BASE = 'http://localhost:5678';
const WORKFLOWS_DIR = path.join(__dirname, 'n8n-workflows');

async function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: url.port || 5678,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('\n🚀 JOB4YOU — Import automatique des workflows n8n\n');

  // 1. Vérifier que n8n est disponible
  try {
    const health = await request('GET', '/healthz');
    if (health.status !== 200) throw new Error('n8n non disponible');
    console.log('✅ n8n est disponible sur', N8N_BASE);
  } catch (e) {
    console.error('❌ n8n n\'est pas démarré. Lance "n8n start" d\'abord.');
    process.exit(1);
  }

  // 2. Récupérer ou créer un owner (setup initial n8n)
  let apiKey = null;
  try {
    // Essayer l'API publique sans auth (n8n < 1.0 ou skipSetup)
    const wfCheck = await request('GET', '/api/v1/workflows');
    if (wfCheck.status === 401) {
      console.log('⚠️  n8n nécessite une authentification.');
      console.log('   Ouvre http://localhost:5678 dans ton navigateur,');
      console.log('   configure ton compte, puis génère une API key dans Settings → API.');
      console.log('   Relance ensuite ce script avec : N8N_API_KEY=ta_cle node setup-n8n.js\n');
      // Continuer sans API key (workflow import via CLI)
    }
  } catch {}

  apiKey = process.env.N8N_API_KEY || null;
  const authHeaders = apiKey ? { 'X-N8N-API-KEY': apiKey } : {};

  // 3. Importer les 3 workflows
  const files = [
    'agent1-cv-parser.json',
    'agent2-rh-manager.json',
    'agent3-entretien.json'
  ];

  const webhookUrls = {};

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\n📥 Import : ${workflow.name}`);

    // Nettoyer les champs read-only rejetés par l'API n8n
    const payload = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings || {},
    };

    // Vérifier si le workflow existe déjà
    const existing = await request('GET', '/api/v1/workflows', null, authHeaders);
    let existingWf = null;
    if (existing.status === 200 && existing.body.data) {
      existingWf = existing.body.data.find(w => w.name === workflow.name);
    }

    let result;
    if (existingWf) {
      console.log(`   ↩️  Workflow existant — mise à jour (ID: ${existingWf.id})`);
      result = await request('PUT', `/api/v1/workflows/${existingWf.id}`, payload, authHeaders);
    } else {
      result = await request('POST', '/api/v1/workflows', payload, authHeaders);
    }

    if (result.status === 200 || result.status === 201) {
      const wf = result.body;
      const id = wf.id || wf.data?.id;

      // Activer le workflow
      await request('POST', `/api/v1/workflows/${id}/activate`, {}, authHeaders);

      // Trouver le nœud webhook
      const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
      if (webhookNode) {
        const webhookPath = webhookNode.parameters.path;
        const webhookUrl = `${N8N_BASE}/webhook/${webhookPath}`;
        webhookUrls[webhookPath] = webhookUrl;
        console.log(`   ✅ Activé — Webhook URL : ${webhookUrl}`);
      }
    } else {
      console.log(`   ⚠️  Statut ${result.status} :`, JSON.stringify(result.body).substring(0, 200));
    }
  }

  // 4. Afficher le résumé et les lignes à ajouter dans application.properties
  console.log('\n\n' + '═'.repeat(60));
  console.log('📋 CONFIGURATION — Copie dans application.properties :');
  console.log('═'.repeat(60));
  console.log(`n8n.webhook.agent1=${webhookUrls['agent1-cv-parser']     || N8N_BASE + '/webhook/agent1-cv-parser'}`);
  console.log(`n8n.webhook.agent2=${webhookUrls['agent2-rh-manager']    || N8N_BASE + '/webhook/agent2-rh-manager'}`);
  console.log(`n8n.webhook.agent3=${webhookUrls['agent3-entretien']     || N8N_BASE + '/webhook/agent3-entretien'}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
