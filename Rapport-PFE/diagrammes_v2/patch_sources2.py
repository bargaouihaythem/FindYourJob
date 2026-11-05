#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Suite des corrections : fig3_7 (fin), fig3_8w, fig3_10, fig3_4, fig3_6, fig3_9."""
import io, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")

def rd(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()

def wr(p, s):
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)

def sub(name, old, new, count=1):
    p = os.path.join(SRC, name)
    s = rd(p)
    n = s.count(old)
    assert n == count, ("OCCURRENCES", name, n, count, old[:90])
    wr(p, s.replace(old, new))
    print("  ok %-18s %s" % (name, old.strip().splitlines()[0][:66]))

print("== fig3_7 (suite)")
for st in ("INTERVIEW", "FINAL_INTERVIEW", "ACCEPTED", "INTERVIEW_SCHEDULED"):
    sub("fig3_7.puml", "\n%s --> WITHDRAWN\n" % st,
        "\n%s --> WITHDRAWN : retrait du candidat\n" % st)
for st in ("CV_REVIEWED", "PHONE_SCREENING", "TECHNICAL_TEST",
           "INTERVIEW", "FINAL_INTERVIEW"):
    sub("fig3_7.puml", "\n%s --> MANAGER_REJECTED\n" % st,
        "\n%s --> MANAGER_REJECTED : refus du manager\n" % st)
sub("fig3_7.puml", "CV_REVIEWED --> AUTO_REJECTED : score corrigé\n", "")
sub("fig3_7.puml", "override du score par le RH", "override RH du score (justifié)")

print("== fig3_8w (modele relationnel)")
sub("fig3_8w.puml", "  first_name / last_name : varchar\n",
    "  first_name : varchar\n  last_name : varchar\n")
sub("fig3_8w.puml", "  title / description\n",
    "  title : varchar\n  description : text\n")
sub("fig3_8w.puml", "  job_family / seniority_level : varchar\n  status : varchar\n  manager_email : varchar\n",
    "  job_family : varchar\n  seniority_level : varchar\n  status : varchar\n  manager_email : varchar\n")
sub("fig3_8w.puml", "  original_filename / file_path : varchar\n",
    "  original_filename : varchar\n  stored_filename : varchar\n  file_path : varchar\n")
sub("fig3_8w.puml", "  type / status : varchar\n", "  type : varchar\n  status : varchar\n")
sub("fig3_8w.puml", "  entity_type / action : varchar\n",
    "  entity_type : varchar\n  action : varchar\n")
sub("fig3_8w.puml", "  event_key / webhook_url : varchar\n",
    "  event_key : varchar\n  webhook_url : varchar\n")
sub("fig3_8w.puml", "  job_family / seniority_level : varchar\n  weight_technical : double\n",
    "  job_family : varchar\n  seniority_level : varchar\n  weight_technical : double\n")
sub("fig3_8w.puml",
    'entity "candidates" as candidates {\n'
    "  * id : bigint <<PK>>\n"
    "  --\n"
    "  names / email : varchar\n"
    "  status : varchar\n"
    "  ai_score / manual_score : integer\n"
    "  application_date : timestamp\n"
    "  * job_offer_id : bigint <<FK>>\n"
    "}",
    'entity "candidates" as candidates {\n'
    "  * id : bigint <<PK>>\n"
    "  --\n"
    "  first_name : varchar\n"
    "  last_name : varchar\n"
    "  email : varchar\n"
    "  phone : varchar\n"
    "  address : text\n"
    "  linkedin_profile : varchar\n"
    "  cover_letter : text\n"
    "  status : varchar\n"
    "  status_reason : text\n"
    "  status_changed_by : varchar\n"
    "  ai_score : integer\n"
    "  ai_score_source : varchar\n"
    "  ai_summary : text\n"
    "  ai_recommendation : varchar\n"
    "  manual_score : integer\n"
    "  manual_score_reason : text\n"
    "  manual_score_by : varchar\n"
    "  application_date : timestamp\n"
    "  last_updated : timestamp\n"
    "  * job_offer_id : bigint <<FK>>\n"
    "}\n"
    "note bottom of candidates\n"
    "  Colonnes principales ; les sous-scores IA\n"
    "  (technique, communication, adéquation) et\n"
    "  les horodatages de la surcharge manuelle\n"
    "  figurent dans le script DDL.\n"
    "end note")
sub("fig3_8w.puml", "candidates ||--|| cvs", "candidates ||--o| cvs")

print("== fig3_10 (architecture applicative)")
sub("fig3_10.puml", "  [Repositories JPA] as JPA\n",
    "  [Repositories JPA] as JPA\n  [Journal d'audit (AuditLog)] as AUD\n")
sub("fig3_10.puml", "SVC --> N8NC", "SVC --> N8NC\nSVC --> AUD : journalise\nAUD --> JPA")

print("== fig3_4 (sequence decision)")
sub("fig3_4.puml", "Décision ACCEPTED / REJECTED + motif",
    "Décision ACCEPTED /\\nMANAGER_REJECTED + motif")
sub("fig3_4.puml", "CS --> MGR : Décision enregistrée",
    "CS --> MGR : Décision enregistrée\n\n"
    "note right of NS\n"
    "  Les e-mails sont envoyés par le back-end\n"
    "  (NotificationService / EmailService) ;\n"
    "  l'agent n8n de routage déclenche certains\n"
    "  envois via l'API de notification.\n"
    "end note")

print("== fig3_6 (sequence routage)")
sub("fig3_6.puml", "NS --> MGR : E-mail de candidature à évaluer",
    "NS --> MGR : E-mail de candidature à évaluer\n\n"
    "note right of NS\n"
    "  L'envoi est réalisé par le back-end ; les\n"
    "  agents n8n (entretien, décision) appellent\n"
    "  l'API de notification pour déclencher les\n"
    "  e-mails de leur périmètre.\n"
    "end note")

print("== fig3_9 (deploiement)")
sub("fig3_9.puml", '  artifact "n8n (Agents 1, 2, 3)" as N8N\n}\ndatabase "PostgreSQL" as DB\n',
    '  artifact "n8n (Agents 1, 2, 3)" as N8N\n'
    '  database "PostgreSQL" as DB\n}\n')
sub("fig3_9.puml", "N8N --> API : callbacks (recompute)\nN8N --> GC : planification\nN8N --> SMTP : e-mails\n",
    "N8N --> API : callbacks (recompute, lien d'entretien)\n"
    "N8N ..> GC : évolution prévue (non actif)\n")
sub("fig3_9.puml", "API --> SMTP : notifications",
    "API --> SMTP : e-mails (EmailService,\\ncertains déclenchés par n8n)")
sub("fig3_9.puml", "API --> LLM : chatbot",
    "API --> LLM : chatbot\n\n"
    "note bottom of GC\n"
    "  Aucun événement Google Calendar authentifié\n"
    "  n'est créé par le workflow actuel : le lien\n"
    "  d'entretien est un lien de démonstration.\n"
    "  L'intégration Calendar / Meet est une\n"
    "  évolution prévue.\n"
    "end note")

print("TERMINÉ")
