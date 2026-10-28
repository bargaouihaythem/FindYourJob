package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Intégration n8n : le backend publie des événements, les agents les consomment.
 * Aucun agent ne décide de la partie métier — ils envoient les notifications et les callbacks.
 *
 * FLUX : Angular → Spring Boot (règles, JWT/RBAC, statut, audit) → n8n → e-mail / Google Calendar
 *
 * Agent 1 — {@code n8n-workflows/agent1-cv-parser.json}
 *   Déclenché par une nouvelle candidature. Rappelle POST /api/candidates/{id}/ai-score/recompute
 *   (extraction du CV et score Cohere côté Spring), puis envoie l'accusé de réception au candidat.
 *
 * Agent 2 — {@code n8n-workflows/agent2-entretien.json}
 *   Déclenché par la création d'un entretien. Crée l'événement Google Calendar, en extrait le lien
 *   Meet, le renvoie par POST /api/interviews/{id}/meet-link, puis envoie la convocation au
 *   candidat et la confirmation à l'intervieweur. Nœud Calendar en tolérance d'erreur : si le
 *   lien manque, la chaîne d'e-mails continue et l'absence de lien est journalisée.
 *
 * Agent 3 — {@code n8n-workflows/agent3-rh-manager.json}
 *   Déclenché quand le RH valide le dossier. Envoie « Nouveau dossier à examiner » au manager si
 *   le dossier lui est transmis, le refus motivé si le statut est AUTO_REJECTED, les félicitations
 *   et la liste des documents à fournir si le statut est ACCEPTED.
 *
 * Décision de statut après score : CandidateService.AI_SCORE_THRESHOLD = 60
 * (score ≥ 60 → CV_REVIEWED, score < 60 → AUTO_REJECTED).
 */
@Service
public class N8nService {

    private static final Logger log = LoggerFactory.getLogger(N8nService.class);

    /** Nombre de tentatives en cas d'échec réseau */
    private static final int MAX_RETRIES = 2;

    @Value("${n8n.webhook.agent1:}")
    private String agent1Webhook;

    @Value("${n8n.webhook.agent2:}")
    private String agent2Webhook;

    @Value("${n8n.webhook.agent3:}")
    private String agent3Webhook;

    @Value("${n8n.api.key:}")
    private String n8nApiKey;

    private final RestTemplate restTemplate;

    @Autowired(required = false)
    private N8nOutboxService outboxService;

    public N8nService(@Qualifier("n8nRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isAgent1Configured() {
        return !isBlank(agent1Webhook);
    }

    // ================================================================
    // AGENT 1 — CV Parser + Email de confirmation candidat
    //
    // RESPONSABILITÉ SPRING BOOT : sauvegarder la candidature en base
    // RESPONSABILITÉ n8n         : analyser le CV, calculer le score IA,
    //                              envoyer l'email de confirmation
    // ================================================================

    /**
     * Appel ASYNCHRONE (ne bloque pas la réponse HTTP au candidat).
     * L'accusé de réception n'est envoyé QUE par l'Agent 1 : Spring ne l'envoie pas
     * quand ce webhook est configuré (cf. CandidateService#registerCandidate), il n'en
     * assure le repli local que lorsqu'il est absent. L'Agent 1 enrichit ensuite le
     * dossier avec le score IA.
     */
    @Async
    public void triggerAgent1CvParser(Candidate candidate) {
        if (isBlank(agent1Webhook)) {
            log.warn("[N8N Agent1] Webhook non configuré — saisir n8n.webhook.agent1 dans application.properties");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "NOUVELLE_CANDIDATURE");
        payload.put("candidateId", candidate.getId());
        payload.put("email", candidate.getEmail());
        payload.put("lastName", candidate.getLastName());
        payload.put("firstName", candidate.getFirstName());
        payload.put("jobOfferTitle", candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : "Candidature générale");
        payload.put("cvUrl", candidate.getCv() != null ? candidate.getCv().getFileUrl() : null);
        payload.put("coverLetter", candidate.getCoverLetter() != null ? candidate.getCoverLetter() : "");

        enqueueOrSend(candidate.getId() + ":NOUVELLE_CANDIDATURE", agent1Webhook,
                "Agent 1 (CV Parser)", payload);
    }

    // ================================================================
    // AGENT 2 — Planification entretien + Google Calendar + Email participants
    //
    // DÉCLENCHEUR : création d'entretien (RH / manager)
    // RESPONSABILITÉ SPRING BOOT : créer l'entretien en base
    // RESPONSABILITÉ n8n         : créer l'événement Google Calendar,
    //                              générer le lien Meet, envoyer l'email
    // ================================================================

    /**
     * Appel ASYNCHRONE (ne bloque pas la réponse HTTP au manager/RH).
     * Spring Boot a déjà persisté l'entretien ; l'Agent 2 envoie les invitations.
     */
    @Async
    public void triggerAgent2InterviewScheduler(Interview interview) {
        if (isBlank(agent2Webhook)) {
            log.warn("[N8N Agent2] Webhook non configuré — saisir n8n.webhook.agent2 dans application.properties");
            return;
        }

        Candidate candidate = interview.getCandidate();
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "ENTRETIEN_PLANIFIE");
        payload.put("interviewId", interview.getId());
        payload.put("candidateEmail", candidate.getEmail());
        payload.put("candidateFirstName", candidate.getFirstName());
        payload.put("candidateLastName", candidate.getLastName());
        payload.put("interviewerName", interview.getInterviewer().getUsername());
        payload.put("interviewerEmail", interview.getInterviewer().getEmail());
        payload.put("scheduledDate", interview.getInterviewDate().toString());
        payload.put("interviewType", interview.getType().toString());
        payload.put("jobOfferTitle", candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : "Entretien général");
        payload.put("notes", interview.getNotes());

        enqueueOrSend(interview.getId() + ":ENTRETIEN_PLANIFIE", agent2Webhook,
                "Agent 2 (Planification entretien)", payload);
    }

    // ================================================================
    // AGENT 3 — RH → Manager : dossier validé + décision finale
    //
    // DÉCLENCHEUR PRINCIPAL  : Agent 1 passe automatiquement le statut en
    //                          CV_REVIEWED quand score IA >= seuil
    // DÉCLENCHEUR SECONDAIRE : RH manuellement ou décision finale (ACCEPTED/REJECTED)
    // RESPONSABILITÉ SPRING BOOT : détecter le changement de statut
    // RESPONSABILITÉ n8n         : notifier le manager, envoyer le dossier complet
    // ================================================================

    /**
     * Appel ASYNCHRONE déclenché quand le dossier est transmis au manager, c'est-à-dire
     * au passage en évaluation technique (statut TECHNICAL_TEST). Un appel par manager
     * destinataire : n8n notifie ce manager avec le dossier complet.
     */
    @Async
    public void triggerAgent3HrValidation(Long candidateId, String email, String firstName, String lastName,
                                          String jobOfferTitle, String cvUrl, String status,
                                          String managerEmail, String updatedBy) {
        sendAgent3(candidateId, email, firstName, lastName, jobOfferTitle, cvUrl, status, managerEmail,
                updatedBy, 0);
    }

    /**
     * Relance d'une notification déjà routée. La clé d'outbox porte un suffixe
     * « :retry-N » : comme elle n'a jamais été vue, enqueue() ne la déduplique pas
     * et l'événement repart — sans sinon, le renvoi d'un dossier déjà notifié
     * resterait silencieusement ignoré.
     *
     * Volontairement synchrone : l'inscription en base est immédiate, ce qui permet
     * au RH d'obtenir l'état réel dans la réponse de son clic. L'envoi réseau reste,
     * lui, porté par le dispatcheur de l'outbox.
     *
     * @return la clé d'outbox créée, null si le webhook Agent 3 n'est pas configuré
     */
    public String retryAgent3HrValidation(Long candidateId, String email, String firstName, String lastName,
                                          String jobOfferTitle, String cvUrl, String status,
                                          String managerEmail, String updatedBy, int retry) {
        return sendAgent3(candidateId, email, firstName, lastName, jobOfferTitle, cvUrl, status, managerEmail,
                updatedBy, retry);
    }

    private String sendAgent3(Long candidateId, String email, String firstName, String lastName,
                              String jobOfferTitle, String cvUrl, String status,
                              String managerEmail, String updatedBy, int retry) {
        if (isBlank(agent3Webhook)) {
            log.warn("[N8N Agent3] Webhook non configuré — saisir n8n.webhook.agent3 dans application.properties");
            return null;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "DOSSIER_VALIDE_RH");
        payload.put("candidateId", candidateId);
        payload.put("email", email);
        payload.put("firstName", firstName);
        payload.put("lastName", lastName);
        payload.put("jobOfferTitle", jobOfferTitle);
        payload.put("cvUrl", cvUrl);
        payload.put("status", status);
        payload.put("updatedBy", updatedBy);
        payload.put("managerEmail", managerEmail);

        // La clé d'outbox est unique et enqueue() ignore une clé déjà PENDING/SENT :
        // elle doit donc porter le destinataire, sinon le 2e manager d'un même
        // département n'est jamais notifié.
        String eventKey = agent3RoutingKey(candidateId, status, managerEmail, retry);
        enqueueOrSend(eventKey, agent3Webhook, "Agent 3 (RH → Manager)", payload);
        return eventKey;
    }

    /** Clé d'outbox d'une transmission : dossier | événement | statut | destinataire | relance. */
    public static String agent3RoutingKey(Long candidateId, String status, String managerEmail, int retry) {
        String base = candidateId + ":DOSSIER_VALIDE_RH:" + status + ":" + managerEmail;
        return retry > 0 ? base + ":retry-" + retry : base;
    }

    /** Préfixe commun à toutes les transmissions d'un dossier, pour la lecture de l'outbox. */
    public static String agent3RoutingKeyPrefix(Long candidateId) {
        return candidateId + ":DOSSIER_VALIDE_RH:";
    }

    /**
     * Décision finale : ACCEPTED ou REJECTED.
     * Agent 3 envoie un email de félicitation ou de refus poli au candidat.
     */
    @Async
    public void triggerAgent3FinalDecision(Long candidateId, String candidateEmail, String firstName, String lastName,
                                           String jobOfferTitle, String status,
                                           String aiSummary, String aiRecommendation) {
        if (isBlank(agent3Webhook)) {
            log.warn("[N8N Agent3] Webhook non configuré — saisir n8n.webhook.agent3 dans application.properties");
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "DECISION_FINALE");
        payload.put("candidateId", candidateId);
        payload.put("candidateEmail", candidateEmail);
        payload.put("candidateFirstName", firstName);
        payload.put("candidateLastName", lastName);
        payload.put("jobOfferTitle", jobOfferTitle);
        payload.put("status", status); // ACCEPTED, AUTO_REJECTED, MANAGER_REJECTED, HIRED
        payload.put("aiSummary", aiSummary);
        payload.put("aiRecommendation", aiRecommendation);
        payload.put("dateDecision", java.time.LocalDateTime.now().toString());
        enqueueOrSend(candidateId + ":DECISION_FINALE:" + status, agent3Webhook,
                "Agent 3 (Décision finale)", payload);
    }

    // ================================================================
    // AGENT 2 — Déclenchement automatique : profil sélectionné par IA
    //
    // DÉCLENCHEUR : score IA >= seuil → statut CV_REVIEWED
    // ACTION n8n  : email "profil retenu" au candidat
    //               email "à planifier" au manager/RH
    // ================================================================

    /**
     * Appel ASYNCHRONE déclenché automatiquement quand le score IA sélectionne
     * un candidat (CV_REVIEWED). Envoie un email de pré-sélection au candidat
     * et une notification à l'équipe RH pour planifier l'entretien.
     */
    @Async
    public void triggerAgent2CvSelected(Long candidateId, String email, String firstName,
                                         String lastName, String jobOfferTitle, String managerEmail) {
        if (isBlank(agent2Webhook)) {
            log.warn("[N8N Agent2] Webhook non configuré — saisir n8n.webhook.agent2 dans application.properties");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "CV_SELECTIONNE");
        payload.put("candidateId", candidateId);
        payload.put("candidateEmail", email);
        payload.put("candidateFirstName", firstName);
        payload.put("candidateLastName", lastName);
        payload.put("jobOfferTitle", jobOfferTitle);
        payload.put("interviewType", "A_PLANIFIER");
        payload.put("interviewerName", "Équipe RH JOB4YOU");
        payload.put("scheduledDate", "");
        payload.put("notes", "Votre candidature a été retenue par notre IA. L'équipe RH vous contactera pour fixer la date d'entretien.");
        payload.put("managerEmail", managerEmail);

        enqueueOrSend(candidateId + ":CV_SELECTIONNE", agent2Webhook,
                "Agent 2 (CV Sélectionné)", payload);
    }

    private void enqueueOrSend(String eventKey, String webhookUrl, String agentName,
                               Map<String, Object> payload) {
        if (outboxService != null) {
            outboxService.enqueue(eventKey, webhookUrl, agentName, payload);
        } else {
            // Fallback utile pour les tests unitaires ou un profil sans JPA.
            sendWithRetry(webhookUrl, payload, agentName);
        }
    }

    // ================================================================
    // TEST DE CONNECTIVITÉ — utilisé par /api/n8n/test
    // ================================================================

    /**
     * Teste la connectivité vers un webhook n8n.
     * Renvoie un Map avec : ok (boolean), status (int|null), message (String).
     */
    public Map<String, Object> testWebhook(String webhookUrl) {
        Map<String, Object> result = new HashMap<>();
        if (isBlank(webhookUrl)) {
            result.put("ok", false);
            result.put("message", "URL vide — non configurée dans application.properties");
            return result;
        }
        try {
            Map<String, Object> ping = new HashMap<>();
            ping.put("event", "PING");
            ping.put("source", "FindYourJob-SpringBoot");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (n8nApiKey != null && !n8nApiKey.isBlank()) {
                headers.set("X-N8N-API-Key", n8nApiKey);
            }
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(ping, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(webhookUrl, entity, String.class);

            result.put("ok", response.getStatusCode().is2xxSuccessful());
            result.put("status", response.getStatusCode().value());
            result.put("message", "Webhook joignable — HTTP " + response.getStatusCode().value());
            result.put("responseBody", response.getBody());
        } catch (ResourceAccessException e) {
            result.put("ok", false);
            result.put("message", "Timeout ou refus de connexion : " + e.getMessage());
        } catch (Exception e) {
            result.put("ok", false);
            result.put("message", "Erreur : " + e.getMessage());
        }
        return result;
    }

    // ================================================================
    // Méthodes utilitaires
    // ================================================================

    /**
     * Envoie le payload au webhook avec jusqu'à MAX_RETRIES tentatives
     * en cas d'erreur réseau transitoire.
     */
    private void sendWithRetry(String webhookUrl, Map<String, Object> payload, String agentName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (n8nApiKey != null && !n8nApiKey.isBlank()) {
            headers.set("X-N8N-API-Key", n8nApiKey);
        }
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                ResponseEntity<String> response = restTemplate.postForEntity(webhookUrl, entity, String.class);
                log.info("[N8N] {} — tentative {}/{} réussie — HTTP {}",
                        agentName, attempt, MAX_RETRIES, response.getStatusCode().value());
                return; // succès → on sort
            } catch (ResourceAccessException e) {
                log.warn("[N8N] {} — tentative {}/{} échouée (timeout/réseau) : {}",
                        agentName, attempt, MAX_RETRIES, e.getMessage());
            } catch (Exception e) {
                log.error("[N8N] {} — tentative {}/{} échouée : {}",
                        agentName, attempt, MAX_RETRIES, e.getMessage());
                return; // erreur non-réseau → pas de retry
            }
        }
        log.error("[N8N] {} — toutes les tentatives ont échoué. Vérifier que n8n est démarré et le webhook actif.", agentName);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
