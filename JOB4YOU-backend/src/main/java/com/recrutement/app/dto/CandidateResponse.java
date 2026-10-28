package com.recrutement.app.dto;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CandidateResponse {

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    
    private String address;
    private String linkedinProfile;
    private String coverLetter;
    private Candidate.CandidateStatus status;
    private LocalDateTime applicationDate;
    private LocalDateTime lastUpdated;
    private String statusReason;
    private String statusChangedBy;
    private LocalDateTime statusChangedAt;
    private LocalDateTime presentationDate;
    private Long jobOfferId;
    private String jobOfferTitle;
    private com.recrutement.app.entity.JobOffer.JobFamily jobFamily;
    private String departmentName;
    private CVResponse cv;
    private Integer interviewsCount;

    /**
     * État du dernier entretien non annulé du dossier. Le statut de candidature ne bouge pas
     * quand l'entretien se termine (c'est l'avis du manager qui le fait avancer) : sans cette
     * information, la liste affiche « Planifier l'entretien » sur un rendez-vous déjà tenu.
     */
    private String lastInterviewStatus;
    private LocalDateTime lastInterviewDate;
    private Integer feedbacksCount;
    private Integer aiScore;
    private String aiSummary;
    private String aiRecommendation;
    private Integer aiScoreTechnical;
    private Integer aiScoreCommunication;
    private Integer aiScoreSeniorityMatch;
    private String aiScoreSource;
    private Integer manualScore;
    private String manualScoreReason;
    private String manualScoreBy;
    private LocalDateTime manualScoreDate;
    private Integer effectiveScore;
    private String matchedSkills;
    private String missingSkills;
    private Boolean needsHumanReview;
    private String humanReviewReason;

    /** Destination du dossier : gelée à la transmission au manager, jamais déduite du score IA. */
    private String routedManagerName;
    private String routedManagerEmails;
    private LocalDateTime routedAt;
    private RoutingBasis routingBasis;

    // Constructeur pour mapper depuis l'entité Candidate
    public CandidateResponse(Candidate candidate) {
        this.id = candidate.getId();
        this.firstName = candidate.getFirstName();
        this.lastName = candidate.getLastName();
        this.email = candidate.getEmail();
        this.phone = candidate.getPhone();
        this.address = candidate.getAddress();
        this.linkedinProfile = candidate.getLinkedinProfile();
        this.coverLetter = candidate.getCoverLetter();
        this.status = candidate.getStatus();
        this.applicationDate = candidate.getApplicationDate();
        this.lastUpdated = candidate.getLastUpdated();
        this.statusReason = candidate.getStatusReason();
        this.statusChangedBy = candidate.getStatusChangedBy();
        this.statusChangedAt = candidate.getStatusChangedAt();
        this.presentationDate = candidate.getPresentationDate();
        this.jobOfferId = candidate.getJobOffer() != null ? candidate.getJobOffer().getId() : null;
        this.jobOfferTitle = candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : null;
        this.jobFamily = candidate.getJobOffer() != null ? candidate.getJobOffer().getJobFamily() : null;
        this.departmentName = candidate.getJobOffer() != null && candidate.getJobOffer().getDepartment() != null
                ? candidate.getJobOffer().getDepartment().getName() : null;
        this.cv = candidate.getCv() != null ? new CVResponse(candidate.getCv()) : null;
        this.interviewsCount = candidate.getInterviews() != null ? candidate.getInterviews().size() : 0;
        candidate.getInterviews().stream()
                .filter(i -> i.getInterviewDate() != null
                        && i.getStatus() != com.recrutement.app.entity.Interview.InterviewStatus.CANCELLED)
                .max(java.util.Comparator.comparing(
                        com.recrutement.app.entity.Interview::getInterviewDate))
                .ifPresent(last -> {
                    this.lastInterviewStatus = last.getStatus() != null ? last.getStatus().name() : null;
                    this.lastInterviewDate = last.getInterviewDate();
                });
        this.feedbacksCount = candidate.getFeedbacks() != null ? candidate.getFeedbacks().size() : 0;
        this.aiScore = candidate.getAiScore();
        this.aiSummary = candidate.getAiSummary();
        this.aiRecommendation = candidate.getAiRecommendation();
        this.aiScoreTechnical = candidate.getAiScoreTechnical();
        this.aiScoreCommunication = candidate.getAiScoreCommunication();
        this.aiScoreSeniorityMatch = candidate.getAiScoreSeniorityMatch();
        this.aiScoreSource = candidate.getAiScoreSource();
        this.manualScore = candidate.getManualScore();
        this.manualScoreReason = candidate.getManualScoreReason();
        this.manualScoreBy = candidate.getManualScoreBy();
        this.manualScoreDate = candidate.getManualScoreDate();
        this.effectiveScore = candidate.getManualScore() != null ? candidate.getManualScore() : candidate.getAiScore();
        this.matchedSkills = candidate.getMatchedSkills();
        this.missingSkills = candidate.getMissingSkills();
        this.needsHumanReview = candidate.getNeedsHumanReview();
        this.humanReviewReason = candidate.getHumanReviewReason();
        this.routedManagerEmails = candidate.getRoutedManagerEmails();
        this.routedAt = candidate.getRoutedAt();
        this.routingBasis = candidate.getRoutingBasis();
        User routedTo = candidate.getRoutedToManager();
        if (routedTo != null) {
            String name = (routedTo.getFirstName() == null ? "" : routedTo.getFirstName())
                    + " " + (routedTo.getLastName() == null ? "" : routedTo.getLastName());
            this.routedManagerName = name.trim().isEmpty() ? routedTo.getUsername() : name.trim();
        } else if (candidate.getRoutedManagerEmails() != null
                && !candidate.getRoutedManagerEmails().isBlank()) {
            this.routedManagerName = candidate.getRoutedManagerEmails().split(",")[0].trim();
        }
    }
}

