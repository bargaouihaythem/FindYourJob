package com.recrutement.app.dto;

import com.recrutement.app.entity.Interview;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InterviewResponse {

    private Long id;
    private LocalDateTime interviewDate;
    private Interview.InterviewType type;
    private Interview.InterviewStatus status;
    private String notes;
    private Integer durationMinutes;
    private String location;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long candidateId;
    private String candidateName;
    private String candidateEmail;
    private Long interviewerId;
    private String interviewerName;
    private String jobOfferTitle;
    private Integer feedbacksCount;

    // Constructeur pour mapper depuis l'entité Interview
    public InterviewResponse(Interview interview) {
        this.id = interview.getId();
        this.interviewDate = interview.getInterviewDate();
        this.type = interview.getType();
        this.status = interview.getStatus();
        this.notes = interview.getNotes();
        this.durationMinutes = interview.getDurationMinutes();
        this.location = interview.getLocation();
        this.createdAt = interview.getCreatedAt();
        this.updatedAt = interview.getUpdatedAt();
        this.candidateId = interview.getCandidate() != null ? interview.getCandidate().getId() : null;
        this.candidateName = interview.getCandidate() != null ? 
            interview.getCandidate().getFirstName() + " " + interview.getCandidate().getLastName() : null;
        this.candidateEmail = interview.getCandidate() != null ? interview.getCandidate().getEmail() : null;
        this.interviewerId = interview.getInterviewer() != null ? interview.getInterviewer().getId() : null;
        this.interviewerName = interview.getInterviewer() != null ? interview.getInterviewer().getUsername() : null;
        this.jobOfferTitle = interview.getCandidate() != null && interview.getCandidate().getJobOffer() != null ? 
            interview.getCandidate().getJobOffer().getTitle() : null;
        this.feedbacksCount = interview.getFeedbacks() != null ? interview.getFeedbacks().size() : 0;
    }
}

