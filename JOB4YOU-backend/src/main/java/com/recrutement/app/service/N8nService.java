package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          ARCHITECTURE — RESPONSABILITÉS CLAIREMENT DÉFINIES     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Angular       │ Interface utilisateur (RH, candidat, manager)  ║
 * ║  Spring Boot   │ Logique métier, sécurité JWT, base de données   ║
 * ║  n8n (agents)  │ Automation IA : scoring, emails, calendrier     ║
 * ║  PostgreSQL    │ Persistance des données                         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  FLUX :  Angular → Spring Boot → n8n → Email / Calendar         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Agent 1  │ Déclencheur : nouvelle candidature                   ║
 * ║           │ Actions n8n : parse CV, score IA,                    ║
 * ║           │               email "candidature reçue" (accusé)     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Agent 2  │ Déclencheur : RH valide le dossier (CV_REVIEWED)     ║
 * ║           │ Actions n8n : GET /api/n8n/candidatures-du-jour,    ║
 * ║           │               résumé IA, email manager              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Agent 3  │ Déclencheur A : entretien créé (RH / manager)       ║
 * ║           │ Actions n8n  : Google Calendar, lien Meet, email    ║
 * ║           │ Déclencheur B : décision finale (ACCEPTED/REJECTED)  ║
 * ║           │ Actions n8n  : email de décision au candidat        ║
 * ║           │ (Switch node sur event dans n8n)                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
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

    private final RestTemplate restTemplate;

    public N8nService(@Qualifier("n8nRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
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
     * Spring Boot a déjà envoyé son email de confirmation basique ;
     * l'Agent 1 enrichit avec le score IA.
     */
    @Async
    public void triggerAgent1CvParser(Candidate candidate) {
        if (isBlank(agent1Webhook)) {
            log.warn("[N8N Agent1] Webhook non configuré — saisir n8n.webhook.agent1 dans application.properties");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "NOUVELLE_CANDIDATURE");
        payload.put("candidatId", candidate.getId());
        payload.put("email", candidate.getEmail());
        payload.put("nom", candidate.getLastName());
        payload.put("prenom", candidate.getFirstName());
        payload.put("offreTitre", candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : "Candidature générale");
        payload.put("cvUrl", candidate.getCv() != null ? candidate.getCv().getFileUrl() : null);
        payload.put("dateCandidature", candidate.getApplicationDate() != null ? candidate.getApplicationDate().toString() : null);
        // cvContent = lettre de motivation (texte) pour le scoring IA basé sur mots-clés
        payload.put("cvContent", candidate.getCoverLetter() != null ? candidate.getCoverLetter() : "");

        sendWithRetry(agent1Webhook, payload, "Agent 1 (CV Parser)");
    }

    // ================================================================
    // AGENT 2 — RH → Manager : transmission du dossier validé
    //
    // RESPONSABILITÉ RH          : valider administrativement le dossier
    //                              (PATCH /candidates/{id}/status → CV_REVIEWED)
    // RESPONSABILITÉ SPRING BOOT : détecter le changement de statut
    // RESPONSABILITÉ n8n         : notifier le manager, envoyer le dossier complet,
    //                              relancer automatiquement si pas de retour sous 48h
    // ================================================================

    /**
     * Appel ASYNCHRONE déclenché quand un RH valide un dossier (statut CV_REVIEWED).
     * n8n notifie le manager et orchestre la relance si nécessaire.
     */
    @Async
    public void triggerAgent2HrValidation(Long candidatId, String candidatEmail, String candidatNom,
                                          String offreTitre, String cvUrl, String nouveauStatut,
                                          String managerEmail) {
        if (isBlank(agent2Webhook)) {
            log.warn("[N8N Agent2] Webhook non configuré — saisir n8n.webhook.agent2 dans application.properties");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "DOSSIER_VALIDE_RH");
        payload.put("candidatId", candidatId);
        payload.put("candidatEmail", candidatEmail);
        payload.put("candidatNom", candidatNom);
        payload.put("offreTitre", offreTitre);
        payload.put("cvUrl", cvUrl);
        payload.put("nouveauStatut", nouveauStatut);
        payload.put("dateValidation", java.time.LocalDateTime.now().toString());
        payload.put("managerEmail", managerEmail);

        sendWithRetry(agent2Webhook, payload, "Agent 2 (RH → Manager)");
    }

    // ================================================================
    // AGENT 3 — Planification entretien + Google Calendar
    //
    // RESPONSABILITÉ SPRING BOOT : créer l'entretien en base
    // RESPONSABILITÉ n8n         : créer l'événement Google Calendar,
    //                              générer le lien Meet, envoyer l'email
    // ================================================================

    /**
     * Appel ASYNCHRONE (ne bloque pas la réponse HTTP au manager/RH).
     * Spring Boot a déjà persisté l'entretien et envoyé l'email basique.
     */
    @Async
    public void triggerAgent3Scheduler(Interview interview) {
        if (isBlank(agent3Webhook)) {
            log.warn("[N8N Agent3] Webhook non configuré — saisir n8n.webhook.agent3 dans application.properties");
            return;
        }

        Candidate candidate = interview.getCandidate();
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "ENTRETIEN_PLANIFIE");
        payload.put("entretienId", interview.getId());
        payload.put("candidatEmail", candidate.getEmail());
        payload.put("candidatNom", candidate.getFirstName() + " " + candidate.getLastName());
        payload.put("interviewerEmail", interview.getInterviewer().getEmail());
        payload.put("interviewerNom", interview.getInterviewer().getUsername());
        payload.put("dateEntretien", interview.getInterviewDate().toString());
        payload.put("type", interview.getType().toString());
        payload.put("dureeMinutes", interview.getDurationMinutes());
        payload.put("lieu", interview.getLocation());
        payload.put("offreTitre", candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : "Entretien général");
        payload.put("notes", interview.getNotes());

        sendWithRetry(agent3Webhook, payload, "Agent 3 (Scheduler)");
    }

    /**
     * Décision finale : ACCEPTED ou REJECTED.
     * Agent 3 envoie un email de félicitation ou de refus poli au candidat.
     */
    @Async
    public void triggerAgent3FinalDecision(Long candidatId, String candidatEmail, String candidatNom,
                                           String offreTitre, String statut,
                                           String aiSummary, String aiRecommendation) {
        if (isBlank(agent3Webhook)) {
            log.warn("[N8N Agent3] Webhook non configuré — saisir n8n.webhook.agent3 dans application.properties");
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "DECISION_FINALE");
        payload.put("candidatId", candidatId);
        payload.put("candidatEmail", candidatEmail);
        payload.put("candidatNom", candidatNom);
        payload.put("offreTitre", offreTitre);
        payload.put("statut", statut); // ACCEPTED ou REJECTED
        payload.put("aiSummary", aiSummary);
        payload.put("aiRecommendation", aiRecommendation);
        payload.put("dateDecision", java.time.LocalDateTime.now().toString());
        sendWithRetry(agent3Webhook, payload, "Agent 3 (Décision finale)");
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
