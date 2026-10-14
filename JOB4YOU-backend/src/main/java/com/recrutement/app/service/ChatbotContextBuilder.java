package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Feedback;
import com.recrutement.app.entity.Interview;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Construit le bloc de contexte texte injecté dans le prompt système du
 * chatbot candidat, à partir des candidatures RÉELLES d'un candidat.
 *
 * Ne doit JAMAIS inclure : aiScore / aiSummary / aiRecommendation /
 * aiScore(Technical|Communication|SeniorityMatch) / aiScoreSource /
 * manualScore* / statusChangedBy / statusReason (peut contenir un motif de
 * rejet interne type "score IA insuffisant"), interview.notes,
 * interview.interviewer, ni aucune donnée InternalNote.
 */
@Component
public class ChatbotContextBuilder {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final Map<Candidate.CandidateStatus, String> STATUS_LABELS = Map.ofEntries(
            Map.entry(Candidate.CandidateStatus.APPLIED, "Candidature reçue, en cours d'examen"),
            Map.entry(Candidate.CandidateStatus.CV_REVIEWED, "CV examiné, présélectionné(e)"),
            Map.entry(Candidate.CandidateStatus.PHONE_SCREENING, "Entretien téléphonique en cours"),
            Map.entry(Candidate.CandidateStatus.TECHNICAL_TEST, "Évaluation technique en cours"),
            Map.entry(Candidate.CandidateStatus.INTERVIEW, "Entretien en cours"),
            Map.entry(Candidate.CandidateStatus.INTERVIEW_SCHEDULED, "Entretien programmé"),
            Map.entry(Candidate.CandidateStatus.FINAL_INTERVIEW, "Entretien final en cours"),
            // Avis du manager en attente de contre-signature RH : le candidat ne doit pas
            // lire une décision définitive à ce stade.
            Map.entry(Candidate.CandidateStatus.ACCEPTED, "Dossier en cours de validation par le RH"),
            Map.entry(Candidate.CandidateStatus.HIRED, "Recruté(e)"),
            Map.entry(Candidate.CandidateStatus.REJECTED, "Candidature non retenue"),
            Map.entry(Candidate.CandidateStatus.AUTO_REJECTED, "Candidature non retenue"),
            Map.entry(Candidate.CandidateStatus.MANAGER_REJECTED, "Dossier en cours de validation par le RH"),
            Map.entry(Candidate.CandidateStatus.WITHDRAWN, "Candidature retirée")
    );

    private static final Map<Interview.InterviewType, String> INTERVIEW_TYPE_LABELS = Map.of(
            Interview.InterviewType.PHONE_SCREENING, "Entretien téléphonique",
            Interview.InterviewType.TECHNICAL, "Entretien technique",
            Interview.InterviewType.HR, "Entretien RH",
            Interview.InterviewType.MANAGER, "Entretien avec le manager",
            Interview.InterviewType.FINAL, "Entretien final",
            Interview.InterviewType.GROUP, "Entretien de groupe"
    );

    private static final Map<Interview.InterviewStatus, String> INTERVIEW_STATUS_LABELS = Map.of(
            Interview.InterviewStatus.SCHEDULED, "Planifié",
            Interview.InterviewStatus.IN_PROGRESS, "En cours",
            Interview.InterviewStatus.COMPLETED, "Terminé",
            Interview.InterviewStatus.CANCELLED, "Annulé",
            Interview.InterviewStatus.RESCHEDULED, "Reprogrammé"
    );

    public String buildContext(List<Candidate> applications) {
        if (applications == null || applications.isEmpty()) {
            return "Le candidat n'a aucune candidature enregistrée dans le système.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Le candidat a ").append(applications.size())
                .append(applications.size() > 1 ? " candidatures :\n\n" : " candidature :\n\n");

        for (Candidate candidate : applications) {
            appendApplication(sb, candidate);
        }

        return sb.toString();
    }

    private void appendApplication(StringBuilder sb, Candidate candidate) {
        String jobTitle = candidate.getJobOffer() != null && candidate.getJobOffer().getTitle() != null
                ? candidate.getJobOffer().getTitle()
                : "Candidature générale (sans offre spécifique)";

        sb.append("--- Candidature #").append(candidate.getId())
                .append(" — Poste : ").append(jobTitle).append(" ---\n");
        sb.append("Statut : ").append(statusLabel(candidate.getStatus())).append('\n');
        if (candidate.getApplicationDate() != null) {
            sb.append("Date de candidature : ").append(candidate.getApplicationDate().format(DATE_FORMAT)).append('\n');
        }

        List<Interview> interviews = candidate.getInterviews();
        if (interviews != null && !interviews.isEmpty()) {
            sb.append("Entretiens :\n");
            for (Interview interview : interviews) {
                appendInterview(sb, interview);
            }
        }

        List<Feedback> feedbacks = candidate.getFeedbacks();
        if (feedbacks != null) {
            for (Feedback feedback : feedbacks) {
                if (Boolean.TRUE.equals(feedback.getIsSentToCandidate()) && feedback.getContent() != null) {
                    sb.append("Feedback transmis : ").append(feedback.getContent()).append('\n');
                }
            }
        }

        sb.append('\n');
    }

    private void appendInterview(StringBuilder sb, Interview interview) {
        sb.append("  - ").append(INTERVIEW_TYPE_LABELS.getOrDefault(interview.getType(), "Entretien"));
        if (interview.getInterviewDate() != null) {
            sb.append(" le ").append(interview.getInterviewDate().format(DATE_FORMAT));
        }
        sb.append(" (statut : ").append(INTERVIEW_STATUS_LABELS.getOrDefault(interview.getStatus(), "inconnu")).append(')');
        if (interview.getDurationMinutes() != null) {
            sb.append(", durée : ").append(interview.getDurationMinutes()).append(" min");
        }
        if (interview.getLocation() != null && !interview.getLocation().isBlank()) {
            sb.append(", lieu : ").append(interview.getLocation());
        }
        if (interview.getMeetLink() != null && !interview.getMeetLink().isBlank()) {
            sb.append(", lien visio : ").append(interview.getMeetLink());
        }
        sb.append('\n');
    }

    private String statusLabel(Candidate.CandidateStatus status) {
        return STATUS_LABELS.getOrDefault(status, "Statut en cours de traitement");
    }
}
