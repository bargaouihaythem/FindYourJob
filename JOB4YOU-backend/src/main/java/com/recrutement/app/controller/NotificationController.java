package com.recrutement.app.controller;

import com.recrutement.app.dto.EmailRequest;
import com.recrutement.app.dto.EmailResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "API pour la gestion des notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private InterviewRepository interviewRepository;

    @Value("${n8n.api.key:}")
    private String n8nApiKey;

    /**
     * Envoie un email personnalisé
     */
    @PostMapping("/custom-email")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Envoyer un email personnalisé")
    public ResponseEntity<EmailResponse> sendCustomEmail(
            @RequestBody EmailRequest emailRequest) {
        try {
            notificationService.sendCustomEmail(
                emailRequest.getTo(),
                emailRequest.getSubject(),
                emailRequest.getContent(),
                emailRequest.isHtml()
            );
            return ResponseEntity.ok(new EmailResponse(true, "Email envoyé avec succès"));
        } catch (Exception e) {
            return ResponseEntity.ok(new EmailResponse(false, "Erreur lors de l'envoi de l'email: " + e.getMessage()));
        }
    }

    /**
     * Endpoint appelé par l'Agent 2 n8n (cron quotidien 18h).
     * Retourne la liste des candidatures du jour pour analyse IA + notification RH.
     * Sécurisé par clé API dans le header X-N8N-API-Key.
     */
    @GetMapping("/n8n/candidatures-du-jour")
    @Operation(summary = "[Agent 2] Candidatures du jour pour n8n")
    public ResponseEntity<?> getCandidaturesDuJour(
            @RequestHeader(value = "X-N8N-API-Key", required = false) String apiKey) {

        // Vérification simple de la clé API n8n (lue depuis application.properties)
        if (n8nApiKey != null && !n8nApiKey.isBlank() && !n8nApiKey.equals(apiKey)) {
            return ResponseEntity.status(401).body(Map.of("error", "Clé API invalide"));
        }

        LocalDateTime debutJournee = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime finJournee = debutJournee.plusDays(1);

        List<Candidate> candidatsDuJour = candidateRepository.findByApplicationDateBetween(debutJournee, finJournee);

        List<Map<String, Object>> result = candidatsDuJour.stream().map(c -> Map.<String, Object>of(
            "id", c.getId(),
            "nom", c.getFirstName() + " " + c.getLastName(),
            "email", c.getEmail(),
            "statut", c.getStatus().toString(),
            "offre", c.getJobOffer() != null ? c.getJobOffer().getTitle() : "Candidature générale",
            "dateCandidature", c.getApplicationDate().toString(),
            "cvUrl", c.getCv() != null ? c.getCv().getFileUrl() : ""
        )).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "date", LocalDateTime.now().toLocalDate().toString(),
            "total", result.size(),
            "candidatures", result
        ));
    }

    /**
     * Renvoie manuellement l'email de confirmation de candidature (depuis l'interface RH/Admin).
     */
    @PostMapping("/application-confirmation/{candidateId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Renvoyer l'email de confirmation de candidature")
    public ResponseEntity<EmailResponse> sendApplicationConfirmation(
            @PathVariable Long candidateId) {
        return candidateRepository.findById(candidateId)
            .map(candidate -> {
                try {
                    notificationService.sendApplicationConfirmation(candidate);
                    return ResponseEntity.ok(new EmailResponse(true, "Email de confirmation envoyé à " + candidate.getEmail()));
                } catch (Exception e) {
                    return ResponseEntity.ok(new EmailResponse(false, "Erreur : " + e.getMessage()));
                }
            })
            .orElse(ResponseEntity.ok(new EmailResponse(false, "Candidat introuvable")));
    }

    /**
     * Renvoie manuellement l'email d'invitation à un entretien.
     */
    @PostMapping("/interview-invitation/{interviewId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Renvoyer l'email d'invitation à un entretien")
    public ResponseEntity<EmailResponse> sendInterviewInvitation(
            @PathVariable Long interviewId) {
        return interviewRepository.findById(interviewId)
            .map(interview -> {
                try {
                    notificationService.sendInterviewInvitation(interview);
                    return ResponseEntity.ok(new EmailResponse(true, "Email d'invitation envoyé"));
                } catch (Exception e) {
                    return ResponseEntity.ok(new EmailResponse(false, "Erreur : " + e.getMessage()));
                }
            })
            .orElse(ResponseEntity.ok(new EmailResponse(false, "Entretien introuvable")));
    }
}

