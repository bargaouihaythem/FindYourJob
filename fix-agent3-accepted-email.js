const path = require('path');
const sqlite3 = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'sqlite3', 'lib', 'sqlite3.js'));
const db = new sqlite3.Database(path.join(process.env.USERPROFILE, '.n8n', 'database.sqlite'));

const wfId = 'vuIc7XWE1gcN4hBG';

// Code node mis à jour : ajoute isAccepted + emailCandidatAccepteHtml (email de félicitations)
const NEW_CODE = [
  "const data = $input.first().json.body || $input.first().json;",
  "const candidateId   = data.candidateId || data.candidatId;",
  "const candidatEmail = data.email || data.candidatEmail || data.candidateEmail || '';",
  "const nom           = data.lastName || data.candidatNom || data.candidateLastName || '';",
  "const prenom        = data.firstName || data.candidatPrenom || data.candidateFirstName || '';",
  "const offreTitre    = data.jobOfferTitle || data.offreTitre || 'le poste';",
  "const statut        = data.status || data.nouveauStatut || 'CV_REVIEWED';",
  "const managerEmail  = data.managerEmail || 'bargaouihaythem1@gmail.com';",
  "const cvUrl         = data.cvUrl || null;",
  "const date          = new Date().toLocaleDateString('fr-FR');",
  "const isRejected    = statut === 'AUTO_REJECTED' || statut === 'MANAGER_REJECTED' || statut === 'REJECTED';",
  "const isAccepted    = statut === 'ACCEPTED' || statut === 'HIRED';",
  "const statutMap = {",
  "  CV_REVIEWED:      'CV Valide - profil retenu',",
  "  AUTO_REJECTED:    'Profil insuffisant (score IA < 60)',",
  "  MANAGER_REJECTED: 'Refuse par le manager',",
  "  REJECTED:         'Candidature refusee',",
  "  ACCEPTED:         'Accepte',",
  "  HIRED:            'Embauche',",
  "};",
  "const statutLabel = statutMap[statut] || statut;",
  "",
  "const emailManagerHtml = '<html><body style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">'",
  "  + '<div style=\"background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0;\">'",
  "  + '<h1 style=\"margin:0\">JOB4YOU</h1><p style=\"margin:4px 0 0\">Nouveau dossier candidat a examiner</p></div>'",
  "  + '<div style=\"background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;\">'",
  "  + '<p>Bonjour,</p>'",
  "  + '<p>Un dossier candidat vient d\\'etre valide par le systeme RH.</p>'",
  "  + '<div style=\"background:white;border-left:4px solid #10b981;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;\">'",
  "  + '<h3 style=\"color:#059669;margin-top:0;\">' + prenom + ' ' + nom + '</h3>'",
  "  + '<table style=\"width:100%;border-collapse:collapse;\">'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;width:140px;\">Poste</td><td style=\"font-weight:bold;\">' + offreTitre + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Statut</td><td style=\"font-weight:bold;color:#1e40af;\">' + statutLabel + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Email candidat</td><td>' + candidatEmail + '</td></tr>'",
  "  + '<tr><td style=\"color:#6b7280;padding:6px 0;\">Date</td><td>' + date + '</td></tr>'",
  "  + (cvUrl ? '<tr><td style=\"color:#6b7280;padding:6px 0;\">CV</td><td><a href=\"' + cvUrl + '\">Telecharger le CV</a></td></tr>' : '')",
  "  + '</table></div>'",
  "  + '<p>Si le profil vous convient, planifiez un entretien sur la plateforme JOB4YOU.</p>'",
  "  + '<p style=\"color:#6b7280;font-size:12px;margin-top:24px;\">Email automatique JOB4YOU Agent 3 — ' + date + '</p>'",
  "  + '</div></body></html>';",
  "",
  "const emailCandidatHtml = '<html><body style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">'",
  "  + '<div style=\"background:#dc2626;color:white;padding:24px;border-radius:8px 8px 0 0;\">'",
  "  + '<h1 style=\"margin:0\">JOB4YOU</h1><p style=\"margin:4px 0 0\">Resultat de votre candidature</p></div>'",
  "  + '<div style=\"background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;\">'",
  "  + '<h2 style=\"color:#1e40af;\">Bonjour ' + prenom + ',</h2>'",
  "  + '<p>Merci pour l\\'interet porte a notre entreprise et pour votre candidature au poste de <b>' + offreTitre + '</b>.</p>'",
  "  + '<div style=\"background:white;border-left:4px solid #dc2626;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;\">'",
  "  + '<p><b>Statut :</b> ' + statutLabel + '</p>'",
  "  + '</div>'",
  "  + '<p>Cette decision ne remet pas en cause vos competences. Nous vous encourageons a postuler pour d\\'autres offres sur JOB4YOU.</p>'",
  "  + '<p>Cordialement,<br><b>L\\'equipe RH JOB4YOU</b></p>'",
  "  + '<p style=\"color:#6b7280;font-size:12px;margin-top:24px;\">Email automatique JOB4YOU Agent 3 — ' + date + '</p>'",
  "  + '</div></body></html>';",
  "",
  "const emailCandidatAccepteHtml = '<html><body style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">'",
  "  + '<div style=\"background:#059669;color:white;padding:24px;border-radius:8px 8px 0 0;\">'",
  "  + '<h1 style=\"margin:0\">JOB4YOU</h1><p style=\"margin:4px 0 0\">Felicitations !</p></div>'",
  "  + '<div style=\"background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;\">'",
  "  + '<h2 style=\"color:#1e40af;\">Bonjour ' + prenom + ',</h2>'",
  "  + '<p>Nous avons le plaisir de vous informer que votre candidature au poste de <b>' + offreTitre + '</b> a ete retenue.</p>'",
  "  + '<div style=\"background:white;border-left:4px solid #059669;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;\">'",
  "  + '<p><b>Statut :</b> ' + statutLabel + '</p>'",
  "  + '</div>'",
  "  + '<p>L\\'equipe RH reviendra vers vous prochainement pour la suite du processus (planification, integration).</p>'",
  "  + '<p>Toutes nos felicitations !</p>'",
  "  + '<p>Cordialement,<br><b>L\\'equipe RH JOB4YOU</b></p>'",
  "  + '<p style=\"color:#6b7280;font-size:12px;margin-top:24px;\">Email automatique JOB4YOU Agent 3 — ' + date + '</p>'",
  "  + '</div></body></html>';",
  "",
  "return [{ json: { candidateId, candidatEmail, nom, prenom, offreTitre, statut, statutLabel, managerEmail, cvUrl, date, isRejected, isAccepted, emailManagerHtml, emailCandidatHtml, emailCandidatAccepteHtml } }];"
].join('\n');

const NEW_NODE_IF_ACCEPTED = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict'
      },
      conditions: [
        {
          id: 'c1',
          leftValue: "={{ $json.isAccepted }}",
          rightValue: true,
          operator: {
            type: 'boolean',
            operation: 'equals'
          }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: 'if-accepted',
  name: 'Accepté (décision finale) ?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [928, 304]
};

const NEW_NODE_EMAIL_ACCEPTE = {
  parameters: {
    fromEmail: 'bargaouihaythem1@gmail.com',
    toEmail: "={{ $json.candidatEmail }}",
    subject: '=🎉 Félicitations — Votre candidature est retenue — {{ $json.offreTitre }}',
    emailType: 'html',
    html: '={{ $json.emailCandidatAccepteHtml }}',
    options: {}
  },
  id: 'email-candidat-accepte',
  name: 'Email — Candidat (félicitations)',
  type: 'n8n-nodes-base.emailSend',
  typeVersion: 2.1,
  position: [1184, 160],
  credentials: {
    smtp: {
      id: 'IfwIPrT1KMjf4UMR',
      name: 'SMTP account'
    }
  },
  continueOnFail: true
};

db.get('SELECT nodes, connections FROM workflow_entity WHERE id = ?', [wfId], (readErr, row) => {
  if (readErr || !row) {
    console.error('Read failed:', readErr ? readErr.message : 'row not found');
    db.close();
    return;
  }

  const nodes = JSON.parse(row.nodes || '[]');
  const connections = JSON.parse(row.connections || '{}');

  // 1) Met à jour le code node avec isAccepted + email de félicitations
  const prepareNode = nodes.find((n) => n.name === 'Préparer données dossier');
  if (prepareNode) {
    prepareNode.parameters.jsCode = NEW_CODE;
  } else {
    console.error('Node "Préparer données dossier" introuvable — abandon');
    db.close();
    return;
  }

  // 2) Repositionne le node Manager (décalé pour laisser la place au nouveau IF)
  const managerNode = nodes.find((n) => n.name === 'Email — Manager (dossier validé)');
  if (managerNode) {
    managerNode.position = [1184, 450];
  }

  // 3) Ajoute les 2 nouveaux nodes s'ils n'existent pas déjà (idempotent)
  if (!nodes.find((n) => n.id === 'if-accepted')) {
    nodes.push(NEW_NODE_IF_ACCEPTED);
  }
  if (!nodes.find((n) => n.id === 'email-candidat-accepte')) {
    nodes.push(NEW_NODE_EMAIL_ACCEPTE);
  }

  // 4) Reconnecte le graphe :
  //    Rejeté ou Validé ? --false--> Accepté (décision finale) ?
  //    Accepté (décision finale) ? --true--> Email — Candidat (félicitations)
  //    Accepté (décision finale) ? --false--> Email — Manager (dossier validé)
  connections['Rejeté ou Validé ?'] = {
    main: [
      [{ node: 'Email — Candidat (refus IA)', type: 'main', index: 0 }],
      [{ node: 'Accepté (décision finale) ?', type: 'main', index: 0 }]
    ]
  };

  connections['Accepté (décision finale) ?'] = {
    main: [
      [{ node: 'Email — Candidat (félicitations)', type: 'main', index: 0 }],
      [{ node: 'Email — Manager (dossier validé)', type: 'main', index: 0 }]
    ]
  };

  db.run('UPDATE workflow_entity SET nodes = ?, connections = ?, updatedAt = ? WHERE id = ?',
    [JSON.stringify(nodes), JSON.stringify(connections), new Date().toISOString(), wfId],
    (updateErr) => {
      if (updateErr) {
        console.error('Update failed:', updateErr.message);
      } else {
        console.log('✅ Agent 3 patché : branche ACCEPTED/HIRED ajoutée avec email de félicitations au candidat.');
        console.log('⚠️  Redémarre n8n (ou désactive/réactive le workflow "Agent 3") pour que le changement soit pris en compte.');
      }
      db.close();
    }
  );
});
