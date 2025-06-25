package com.recrutement.app.service;

import com.recrutement.app.entity.*;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
public class NotificationService {

    @Autowired
    private EmailService emailService;

    @Autowired
    private CandidateRepository candidateRepository;

    /**
     * Envoie un e-mail de confirmation de candidature
     */
    public void sendApplicationConfirmation(Candidate candidate) {
        JobOffer jobOffer = candidate.getJobOffer();
        String candidateEmail = candidate.getEmail();
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();
        
        // Gestion du cas où le candidat n'a pas d'offre d'emploi associée
        String jobOfferTitle = (jobOffer != null) ? jobOffer.getTitle() : "Candidature générale";
        String emailSubject = "Confirmation de votre candidature" + ((jobOffer != null) ? " - " + jobOffer.getTitle() : "");
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("candidateId", candidate.getId());
        variables.put("jobOfferTitle", jobOfferTitle);
        variables.put("jobOfferLocation", (jobOffer != null) ? jobOffer.getLocation() : "Non spécifié");
        variables.put("jobOfferContractType", (jobOffer != null) ? jobOffer.getContractType() : "Non spécifié");
        variables.put("applicationDate", candidate.getApplicationDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        
        emailService.sendTemplateEmail(
            candidateEmail,
            emailSubject,
            "emails/application-confirmation",
            variables
        );
    }

    /**
     * Envoie un e-mail d'invitation à un entretien
     */
    public void sendInterviewInvitation(Interview interview) {
        Candidate candidate = interview.getCandidate();
        String candidateEmail = candidate.getEmail();
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();
        JobOffer jobOffer = candidate.getJobOffer();
        
        // Gestion du cas où le candidat n'a pas d'offre d'emploi associée
        String jobOfferTitle = (jobOffer != null) ? jobOffer.getTitle() : "Entretien général";
        String emailSubject = "Invitation à un entretien" + ((jobOffer != null) ? " - " + jobOffer.getTitle() : "");
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("jobOfferTitle", jobOfferTitle);
        variables.put("interviewType", interview.getType().toString());
        variables.put("interviewDate", interview.getInterviewDate());
        variables.put("duration", interview.getDurationMinutes());
        variables.put("location", interview.getLocation());
        variables.put("interviewerName", interview.getInterviewer().getUsername());
        variables.put("notes", interview.getNotes());
        
        emailService.sendTemplateEmail(
            candidateEmail,
            emailSubject,
            "emails/interview-invitation",
            variables
        );
    }

    /**
     * Envoie un e-mail de feedback au candidat
     */
    public void sendFeedbackNotification(Feedback feedback) {
        Candidate candidate = feedback.getCandidate();
        String candidateEmail = candidate.getEmail();
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();
        JobOffer jobOffer = candidate.getJobOffer();
        
        // Gestion du cas où le candidat n'a pas d'offre d'emploi associée
        String jobOfferTitle = (jobOffer != null) ? jobOffer.getTitle() : "Processus de recrutement";
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("jobOfferTitle", jobOfferTitle);
        variables.put("feedbackType", feedback.getType().toString());
        variables.put("feedbackContent", feedback.getContent());
        variables.put("rating", feedback.getRating());
        
        if (feedback.getInterview() != null) {
            variables.put("interviewType", feedback.getInterview().getType().toString());
        }
        
        // Déterminer les prochaines étapes en fonction du statut du candidat
        String nextSteps = null;
        switch (candidate.getStatus()) {
            case ACCEPTED:
                nextSteps = "Félicitations ! Votre candidature a été retenue. Nous vous contacterons prochainement pour discuter des détails de votre intégration.";
                break;
            case REJECTED:
                nextSteps = "Nous sommes désolés de vous informer que votre candidature n'a pas été retenue pour ce poste. Nous vous encourageons à consulter nos autres offres d'emploi.";
                break;
            case PHONE_SCREENING:
                nextSteps = "Vous serez prochainement contacté(e) pour un entretien téléphonique.";
                break;
            case TECHNICAL_TEST:
                nextSteps = "Vous serez prochainement invité(e) à passer un test technique.";
                break;
            case INTERVIEW:
                nextSteps = "Vous serez prochainement invité(e) à un entretien avec notre équipe.";
                break;
            case FINAL_INTERVIEW:
                nextSteps = "Vous serez prochainement invité(e) à un entretien final.";
                break;
            default:
                nextSteps = "Nous vous tiendrons informé(e) de la suite du processus de recrutement.";
        }
        variables.put("nextSteps", nextSteps);
        
        emailService.sendTemplateEmail(
            candidateEmail,
            "Feedback sur votre candidature" + ((jobOffer != null) ? " - " + jobOffer.getTitle() : ""),
            "emails/feedback-notification",
            variables
        );
        
        // Mettre à jour le statut du feedback
        feedback.setIsSentToCandidate(true);
        feedback.setStatus(Feedback.FeedbackStatus.SENT);
    }

    /**
     * Envoie une notification détaillée au candidat
     */
    public void sendDetailedFeedbackNotification(Long candidateId, String subject, String message, 
                                                String interviewDetails, String feedbackSummary) {
        // Récupérer le candidat depuis la base de données
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + candidateId));
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("subject", subject);
        variables.put("message", message);
        variables.put("interviewDetails", interviewDetails != null ? interviewDetails : "");
        variables.put("feedbackSummary", feedbackSummary != null ? feedbackSummary : "");
        variables.put("candidateId", candidateId);
        variables.put("candidateName", candidate.getFirstName() + " " + candidate.getLastName());
        
        emailService.sendTemplateEmail(
            candidate.getEmail(),
            subject,
            "emails/detailed-feedback-notification",
            variables
        );
    }

    /**
     * Envoie un email personnalisé
     */
    public void sendCustomEmail(String to, String subject, String content, boolean isHtml) {
        if (isHtml) {
            emailService.sendHtmlEmail(to, subject, content);
        } else {
            emailService.sendSimpleEmail(to, subject, content);
        }
    }
}

