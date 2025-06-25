package com.recrutement.app.dto;

import com.recrutement.app.entity.Feedback;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackResponse {

    private Long id;
    private String content;
    private Integer rating;
    private Feedback.FeedbackType type;
    private Feedback.FeedbackStatus status;
    private Boolean isSentToCandidate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime sentAt;
    private Long candidateId;
    private String candidateName;
    private String candidateEmail;
    private Long authorId;
    private String authorName;
    private Long interviewId;
    private String interviewType;
    private String jobOfferTitle;

    // Constructeur pour mapper depuis l'entité Feedback
    public FeedbackResponse(Feedback feedback) {
        this.id = feedback.getId();
        this.content = feedback.getContent();
        this.rating = feedback.getRating();
        this.type = feedback.getType();
        this.status = feedback.getStatus();
        this.isSentToCandidate = feedback.getIsSentToCandidate();
        this.createdAt = feedback.getCreatedAt();
        this.updatedAt = feedback.getUpdatedAt();
        this.sentAt = feedback.getSentAt();
        this.candidateId = feedback.getCandidate() != null ? feedback.getCandidate().getId() : null;
        this.candidateName = feedback.getCandidate() != null ? 
            feedback.getCandidate().getFirstName() + " " + feedback.getCandidate().getLastName() : null;
        this.candidateEmail = feedback.getCandidate() != null ? feedback.getCandidate().getEmail() : null;
        this.authorId = feedback.getAuthor() != null ? feedback.getAuthor().getId() : null;
        this.authorName = feedback.getAuthor() != null ? feedback.getAuthor().getUsername() : null;
        this.interviewId = feedback.getInterview() != null ? feedback.getInterview().getId() : null;
        this.interviewType = feedback.getInterview() != null ? feedback.getInterview().getType().toString() : null;
        this.jobOfferTitle = feedback.getCandidate() != null && feedback.getCandidate().getJobOffer() != null ? 
            feedback.getCandidate().getJobOffer().getTitle() : null;
    }
}

