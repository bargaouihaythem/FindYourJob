package com.recrutement.app.dto;

import com.recrutement.app.entity.Candidate;
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
    private Long jobOfferId;
    private String jobOfferTitle;
    private CVResponse cv;
    private Integer interviewsCount;
    private Integer feedbacksCount;

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
        this.jobOfferId = candidate.getJobOffer() != null ? candidate.getJobOffer().getId() : null;
        this.jobOfferTitle = candidate.getJobOffer() != null ? candidate.getJobOffer().getTitle() : null;
        this.cv = candidate.getCv() != null ? new CVResponse(candidate.getCv()) : null;
        this.interviewsCount = candidate.getInterviews() != null ? candidate.getInterviews().size() : 0;
        this.feedbacksCount = candidate.getFeedbacks() != null ? candidate.getFeedbacks().size() : 0;
    }
}

