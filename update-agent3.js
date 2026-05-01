const https = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MzY1OWRmMS1kODMyLTQ5NzktOTYzZi1kOTllMjVmMzNkZmMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzM3YzFkYzUtNzRiNy00YzY0LWFjMmMtNjlmZWFlNTEzOGI2IiwiaWF0IjoxNzc3MjMyODM2fQ.7MhdSXZfaVibA_ZngZR5P3C4_hiEW_cEa8Wy91hyLmU';
const WORKFLOW_ID = 'aDlMEwef9SLGf0Xd';

// Code JS pour le nœud de branchement
const checkEventCode = `var data = $input.first().json.body || $input.first().json;
var event = data.event || 'ENTRETIEN_PLANIFIE';
return [{ json: { ...data, event } }];`;

// Code JS pour préparer l'email décision finale (ACCEPTED / REJECTED)
const finalDecisionCode = `var data = $input.first().json.body || $input.first().json;
var candidatEmail = data.candidatEmail || '';
var candidatNom   = data.candidatNom   || '';
var offreTitre    = data.offreTitre    || 'le poste';
var statut        = data.statut        || 'REJECTED';
var isAccepted    = statut === 'ACCEPTED';

var css = '<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}' +
  '.hdr{color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}' +
  '.hdr-ok{background:#28a745}.hdr-ko{background:#dc3545}' +
  '.cnt{background:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}' +
  '.box{background:white;padding:20px;margin:20px 0;border-radius:5px}' +
  '.box-ok{border-left:4px solid #28a745}.box-ko{border-left:4px solid #dc3545}' +
  '.ftr{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}' +
  '</style>';

var head = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css + '</head>';
var html = head + '<body>';

if (isAccepted) {
  html += '<div class="hdr hdr-ok"><h1>🎉 Félicitations !</h1></div>';
  html += '<div class="cnt">';
  html += '<p>Bonjour <strong>' + candidatNom + '</strong>,</p>';
  html += '<p>Nous avons le grand plaisir de vous informer que votre candidature pour le poste :</p>';
  html += '<h3 style="color:#28a745;text-align:center">' + offreTitre + '</h3>';
  html += '<div class="box box-ok">';
  html += '<p>✅ <strong>Votre candidature a été acceptée !</strong></p>';
  html += '<p>Notre équipe RH va vous contacter très prochainement pour les prochaines étapes (contrat, date de début, etc.).</p>';
  html += '</div>';
  html += '<p>Nous sommes ravis de vous accueillir dans notre équipe et nous nous réjouissons de travailler avec vous.</p>';
  html += "<p>Cordialement,<br>L'\u00e9quipe de recrutement JOB4YOU</p>";
  html += '</div>';
} else {
  html += '<div class="hdr hdr-ko"><h1>Résultat de votre candidature</h1></div>';
  html += '<div class="cnt">';
  html += '<p>Bonjour <strong>' + candidatNom + '</strong>,</p>';
  html += "<p>Nous vous remercions de l'int\u00e9r\u00eat que vous portez au poste :</p>";
  html += '<h3 style="color:#dc3545;text-align:center">' + offreTitre + '</h3>';
  html += '<div class="box box-ko">';
  html += '<p>Après examen attentif de votre dossier, nous avons le regret de vous informer que nous ne sommes pas en mesure de donner une suite favorable à votre candidature.</p>';
  html += "<p>Cette d\u00e9cision ne remet pas en cause vos qualit\u00e9s, mais r\u00e9sulte d'un choix entre plusieurs profils tr\u00e8s comp\u00e9tents.</p>";
  html += '</div>';
  html += "<p>Nous conservons votre CV et nous n'h\u00e9siterons pas \u00e0 vous recontacter si une opportunit\u00e9 correspondant \u00e0 votre profil se pr\u00e9sente.</p>";
  html += '<p>Nous vous souhaitons plein succès dans vos recherches.</p>';
  html += "<p>Cordialement,<br>L'\u00e9quipe de recrutement JOB4YOU</p>";
  html += '</div>';
}
html += '<div class="ftr"><p>Email automatique - JOB4YOU 2026</p></div></body></html>';

var subject = isAccepted
  ? '🎉 Candidature acceptée — ' + offreTitre
  : 'Résultat de votre candidature — ' + offreTitre;

return [{ json: { candidatEmail, candidatNom, offreTitre, statut, emailHtml: html, subject } }];`;

const payload = {
  name: "Agent 3 — Planification entretien + Email participants",
  nodes: [
    {
      id: "webhook-agent3",
      name: "Webhook — Entretien créé",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [240, 300],
      parameters: {
        httpMethod: "POST",
        path: "agent3-entretien",
        responseMode: "lastNode",
        options: {}
      },
      webhookId: "agent3-entretien"
    },
    {
      id: "check-event-type",
      name: "Type d'événement ?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [480, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
          conditions: [{
            id: "cond1",
            leftValue: "={{ ($input.first().json.body || $input.first().json).event }}",
            rightValue: "DECISION_FINALE",
            operator: { type: "string", operation: "equals" }
          }],
          combinator: "and"
        }
      }
    },
    {
      id: "prepare-final-decision",
      name: "Préparer email décision finale",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [720, 120],
      parameters: { jsCode: finalDecisionCode }
    },
    {
      id: "email-final-decision",
      name: "Email — Décision finale (candidat)",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2.1,
      position: [960, 120],
      parameters: {
        fromEmail: "noreply@job4you.com",
        toEmail: "={{ $json.candidatEmail }}",
        subject: "={{ $json.subject }}",
        emailType: "html",
        html: "={{ $json.emailHtml }}"
      },
      credentials: { smtp: { id: "IfwIPrT1KMjf4UMR", name: "SMTP account" } }
    },
    {
      id: "prepare-interview",
      name: "Préparer données entretien",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [720, 420],
      parameters: {
        jsCode: `var data = $input.first().json.body || $input.first().json;\nvar candidatEmail  = data.candidatEmail || '';\nvar candidatNom    = data.candidatNom   || '';\nvar candidatPrenom = data.candidatPrenom || '';\nvar rhEmail        = data.rhEmail       || 'bargaouihaythem1@gmail.com';\nvar offreTitre     = data.offreTitre    || 'le poste';\nvar type           = data.type          || 'HR';\nvar lieu           = data.lieu          || 'A definir';\nvar dateEntretien  = data.dateEntretien ? new Date(data.dateEntretien).toLocaleString('fr-FR') : 'A confirmer';\nvar meetLink = 'https://meet.google.com/' + Math.random().toString(36).substr(2, 10);\nvar meetBtn = '<a href="' + meetLink + '" style="display:inline-block;background:#4285f4;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;font-weight:bold">Rejoindre Google Meet</a>';\nvar css = '<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.hdr{background:#17a2b8;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}.cnt{background:#f8f9fa;padding:30px;border-radius:0 0 5px 5px}.box{background:white;padding:20px;margin:20px 0;border-left:4px solid #17a2b8;border-radius:5px}.rw{margin:10px 0;padding:5px 0;border-bottom:1px solid #e9ecef}.lbl{font-weight:bold;display:inline-block;min-width:130px}.warn{background:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:5px;margin:15px 0}.ftr{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #dee2e6;color:#6c757d;font-size:14px}</style>';\nvar head = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css + '</head>';\nvar emailCandidatHtml = head + '<body>';\nemailCandidatHtml += '<div class="hdr"><h1>Invitation a un entretien</h1></div>';\nemailCandidatHtml += '<div class="cnt">';\nemailCandidatHtml += '<p>Bonjour <strong>' + candidatPrenom + ' ' + candidatNom + '</strong>,</p>';\nemailCandidatHtml += '<p>Nous avons le plaisir de vous inviter a un entretien pour le poste :</p>';\nemailCandidatHtml += '<h3 style="color:#17a2b8;text-align:center">' + offreTitre + '</h3>';\nemailCandidatHtml += '<div class="box"><h4>Details :</h4>';\nemailCandidatHtml += '<div class="rw"><span class="lbl">Type :</span>' + type + '</div>';\nemailCandidatHtml += '<div class="rw"><span class="lbl">Date et heure :</span>' + dateEntretien + '</div>';\nemailCandidatHtml += '<div class="rw"><span class="lbl">Lieu :</span>' + lieu + '</div>';\nemailCandidatHtml += '<div class="rw"><span class="lbl">Lien Meet :</span>' + meetBtn + '</div>';\nemailCandidatHtml += '</div>';\nemailCandidatHtml += '<div class="warn"><ul>';\nemailCandidatHtml += '<li>Merci de confirmer votre presence</li>';\nemailCandidatHtml += '<li>Veuillez arriver 10 min avant</li>';\nemailCandidatHtml += '<li>En cas d empechement, prevenez-nous</li>';\nemailCandidatHtml += '</ul></div>';\nemailCandidatHtml += '<p>Cordialement,<br>L equipe de recrutement JOB4YOU</p>';\nemailCandidatHtml += '</div><div class="ftr"><p>Email automatique - JOB4YOU 2026</p></div></body></html>';\nvar emailRhHtml = head + '<body>';\nemailRhHtml += '<div class="hdr"><h1>Entretien planifie avec succes</h1></div>';\nemailRhHtml += '<div class="cnt">';\nemailRhHtml += '<p>L entretien suivant a ete planifie et le candidat a ete notifie :</p>';\nemailRhHtml += '<div class="box">';\nemailRhHtml += '<p><strong>Candidat :</strong> ' + candidatPrenom + ' ' + candidatNom + '</p>';\nemailRhHtml += '<p><strong>Email :</strong> ' + candidatEmail + '</p>';\nemailRhHtml += '<p><strong>Poste :</strong> ' + offreTitre + '</p>';\nemailRhHtml += '<p><strong>Type :</strong> ' + type + '</p>';\nemailRhHtml += '<p><strong>Date et heure :</strong> ' + dateEntretien + '</p>';\nemailRhHtml += '<p><strong>Lieu :</strong> ' + lieu + '</p>';\nemailRhHtml += '<p><strong>Lien Meet :</strong> ' + meetBtn + '</p>';\nemailRhHtml += '</div>';\nemailRhHtml += '<p>Cordialement,<br>La plateforme JOB4YOU</p>';\nemailRhHtml += '</div><div class="ftr"><p>Email automatique - JOB4YOU 2026</p></div></body></html>';\nreturn [{ json: { candidatEmail, candidatNom, candidatPrenom, rhEmail, offreTitre, type, lieu, dateEntretien, meetLink, emailCandidatHtml, emailRhHtml } }];`
      }
    },
    {
      id: "email-candidat",
      name: "Email — Candidat (convocation)",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2.1,
      position: [960, 360],
      parameters: {
        fromEmail: "noreply@job4you.com",
        toEmail: "={{ $json.candidatEmail }}",
        subject: "={{ '📅 Convocation entretien — ' + $json.offreTitre }}",
        emailType: "html",
        html: "={{ $json.emailCandidatHtml }}"
      },
      credentials: { smtp: { id: "IfwIPrT1KMjf4UMR", name: "SMTP account" } }
    },
    {
      id: "email-rh",
      name: "Email — RH (confirmation planification)",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2.1,
      position: [960, 500],
      parameters: {
        fromEmail: "noreply@job4you.com",
        toEmail: "={{ $json.rhEmail || 'bargaouihaythem1@gmail.com' }}",
        subject: "={{ '✅ Entretien planifié — ' + $json.offreTitre }}",
        emailType: "html",
        html: "={{ $json.emailRhHtml }}"
      },
      credentials: { smtp: { id: "IfwIPrT1KMjf4UMR", name: "SMTP account" } }
    }
  ],
  connections: {
    "Webhook — Entretien créé": {
      main: [[{ node: "Type d'événement ?", type: "main", index: 0 }]]
    },
    "Type d'événement ?": {
      main: [
        [{ node: "Préparer email décision finale", type: "main", index: 0 }],
        [{ node: "Préparer données entretien", type: "main", index: 0 }]
      ]
    },
    "Préparer email décision finale": {
      main: [[{ node: "Email — Décision finale (candidat)", type: "main", index: 0 }]]
    },
    "Préparer données entretien": {
      main: [[
        { node: "Email — Candidat (convocation)", type: "main", index: 0 },
        { node: "Email — RH (confirmation planification)", type: "main", index: 0 }
      ]]
    }
  },
  settings: { executionOrder: "v1" }
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

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Agent 3 mis à jour avec succès !');
    } else {
      console.log('❌ Erreur HTTP', res.statusCode, data.substring(0, 500));
    }
  });
});
req.on('error', e => console.error('❌ Erreur:', e.message));
req.write(body);
req.end();
