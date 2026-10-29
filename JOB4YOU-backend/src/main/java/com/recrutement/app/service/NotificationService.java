package com.recrutement.app.service;

import com.recrutement.app.entity.*;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
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
        variables.put("meetLink", interview.getMeetLink());
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
                nextSteps = "Félicitations ! Votre candidature a été retenue. Nous vous contacterons prochainement pour planifier votre entretien.";
                break;
            case INTERVIEW_SCHEDULED:
                nextSteps = "Votre entretien a été planifié. Vous recevrez une invitation avec tous les détails (date, heure, lien Meet).";
                break;
            case HIRED:
                nextSteps = "Félicitations ! Nous avons le plaisir de vous confirmer votre embauche. Notre équipe RH vous contactera prochainement pour les formalités d'intégration.";
                break;
            case REJECTED:
            case AUTO_REJECTED:
                nextSteps = "Nous sommes désolés de vous informer que votre candidature n'a pas été retenue suite à l'analyse automatique de votre CV. Nous vous encourageons à consulter nos autres offres d'emploi.";
                break;
            case MANAGER_REJECTED:
                nextSteps = "Nous sommes désolés de vous informer que votre candidature n'a pas été retenue pour ce poste après examen par notre équipe. Nous vous encourageons à consulter nos autres offres d'emploi.";
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
     * Envoie un e-mail d'annulation d'entretien au candidat
     */
    public void sendInterviewCancellation(Interview interview) {
        sendInterviewStatusUpdate(interview, "Annulation de votre entretien",
            "Nous vous informons que l'entretien suivant, initialement prévu, a été annulé.",
            "#dc3545");
    }

    /**
     * Envoie un e-mail de reprogrammation d'entretien au candidat
     */
    public void sendInterviewReschedule(Interview interview) {
        sendInterviewStatusUpdate(interview, "Reprogrammation de votre entretien",
            "Votre entretien va être reprogrammé. Vous recevrez une nouvelle invitation avec la date définitive dès qu'elle sera confirmée.",
            "#fd7e14");
    }

    private void sendInterviewStatusUpdate(Interview interview, String subject, String introMessage, String accentColor) {
        Candidate candidate = interview.getCandidate();
        if (candidate == null) {
            return;
        }
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();
        JobOffer jobOffer = candidate.getJobOffer();
        String jobOfferTitle = (jobOffer != null) ? jobOffer.getTitle() : "Entretien général";

        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("jobOfferTitle", jobOfferTitle);
        variables.put("introMessage", introMessage);
        variables.put("accentColor", accentColor);
        variables.put("interviewType", interview.getType().toString());
        variables.put("interviewDate", interview.getInterviewDate());
        variables.put("location", interview.getLocation());
        variables.put("interviewerName", interview.getInterviewer() != null ? interview.getInterviewer().getUsername() : "");

        emailService.sendTemplateEmail(
            candidate.getEmail(),
            subject + ((jobOffer != null) ? " - " + jobOffer.getTitle() : ""),
            "emails/interview-status-update",
            variables
        );
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
     * Informe le candidat que son entretien téléphonique RH a été validé et que son
     * dossier est désormais transmis à l'équipe/manager concerné pour la suite du
     * processus (évaluation technique). Envoyée au moment du passage en TECHNICAL_TEST,
     * en complément de la notification adressée au manager (Agent 3).
     */
    public void sendPhoneScreeningValidatedNotification(Candidate candidate) {
        JobOffer jobOffer = candidate.getJobOffer();
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();
        String jobOfferTitle = (jobOffer != null) ? jobOffer.getTitle() : "votre candidature";

        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("jobOfferTitle", jobOfferTitle);

        emailService.sendTemplateEmail(
            candidate.getEmail(),
            "Votre entretien téléphonique a été validé",
            "emails/phone-screening-validated",
            variables
        );
    }

    /**
     * Informe le RH qu'un manager a rendu un avis sur un dossier, pour contre-signature.
     * L'avis favorable comme la proposition de refus sont notifiés : le RH ne doit pas
     * découvrir une décision en ouvrant la liste par hasard.
     */
    public void sendManagerDecisionToHr(Candidate candidate, Candidate.CandidateStatus decision,
                                         User manager, List<String> hrEmails) {
        JobOffer jobOffer = candidate.getJobOffer();
        boolean favourable = decision == Candidate.CandidateStatus.ACCEPTED;
        String candidateName = candidate.getFirstName() + " " + candidate.getLastName();

        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidateName);
        variables.put("candidateEmail", candidate.getEmail());
        variables.put("jobOfferTitle", jobOffer != null ? jobOffer.getTitle() : "candidature sans offre identifiée");
        variables.put("decisionLabel", favourable ? "Avis favorable" : "Proposition de refus");
        variables.put("decidedBy", displayName(manager));
        variables.put("reason", candidate.getStatusReason() == null ? "" : candidate.getStatusReason());
        variables.put("nextStep", favourable
                ? "Validez l'embauche en précisant la date de présentation des documents, ou renversez cet avis."
                : "Confirmez le refus (le candidat sera alors informé) ou remettez le dossier dans le pipeline.");

        String subject = (favourable ? "Avis favorable à valider — " : "Refus proposé à valider — ")
                + candidateName + " / " + (jobOffer != null ? jobOffer.getTitle() : "candidature");
        // Un seul message pour tous les comptes RH : la boucle par destinataire envoyait
        // une copie indépendante à chacun, et le journal de boîte ne distinguait plus
        // l'avis d'un dossier de la liste des RH.
        emailService.sendTemplateEmail(String.join(", ", hrEmails), subject,
                "emails/manager-decision-hr", variables);
    }

    /**
     * E-mail final au candidat quand le RH contre-signe l'avis favorable : confirmation
     * d'embauche et convocation à la présentation des documents.
     */
    public void sendHiringConvocation(Candidate candidate) {
        JobOffer jobOffer = candidate.getJobOffer();

        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidate.getFirstName() + " " + candidate.getLastName());
        variables.put("jobOfferTitle", jobOffer != null ? jobOffer.getTitle() : "votre candidature");
        variables.put("presentationDate", formatFrenchDateTime(candidate.getPresentationDate()));

        emailService.sendTemplateEmail(
            candidate.getEmail(),
            "Votre candidature est retenue — présentation des documents",
            "emails/hiring-convocation",
            variables
        );
    }

    /**
     * E-mail final au candidat quand le RH confirme un refus. Le motif enregistré reste
     * interne (journal d'audit et vue RH) : il n'est pas recopié au candidat.
     */
    public void sendFinalRejection(Candidate candidate) {
        JobOffer jobOffer = candidate.getJobOffer();

        Map<String, Object> variables = new HashMap<>();
        variables.put("candidateName", candidate.getFirstName() + " " + candidate.getLastName());
        variables.put("jobOfferTitle", jobOffer != null ? jobOffer.getTitle() : "votre candidature");

        emailService.sendTemplateEmail(
            candidate.getEmail(),
            "Réponse à votre candidature",
            "emails/final-rejection",
            variables
        );
    }

    private String displayName(User user) {
        if (user == null) {
            return "un manager";
        }
        String full = ((user.getFirstName() == null ? "" : user.getFirstName() + " ")
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
        return full.isEmpty() ? user.getUsername() : full;
    }

    private String formatFrenchDateTime(java.time.LocalDateTime date) {
        if (date == null) {
            return "";
        }
        return DateTimeFormatter.ofPattern("EEEE d MMMM yyyy 'à' HH:mm", java.util.Locale.FRENCH).format(date);
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

