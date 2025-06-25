package com.recrutement.app.dto;

import com.recrutement.app.entity.JobOffer;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobOfferResponse {

    private Long id;
    private String title;
    private String description;
    private String requiredSkills;
    private String experienceLevel;
    private String contractType;
    private String location;
    private String salaryRange;
    private JobOffer.JobStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deadline;
    private String createdByUsername;
    private Long candidatesCount;

    // Constructeur pour mapper depuis l'entité JobOffer
    public JobOfferResponse(JobOffer jobOffer) {
        this.id = jobOffer.getId();
        this.title = jobOffer.getTitle();
        this.description = jobOffer.getDescription();
        this.requiredSkills = jobOffer.getRequiredSkills();
        this.experienceLevel = jobOffer.getExperienceLevel();
        this.contractType = jobOffer.getContractType();
        this.location = jobOffer.getLocation();
        this.salaryRange = jobOffer.getSalaryRange();
        this.status = jobOffer.getStatus();
        this.createdAt = jobOffer.getCreatedAt();
        this.updatedAt = jobOffer.getUpdatedAt();
        this.deadline = jobOffer.getDeadline();
        this.createdByUsername = jobOffer.getCreatedBy() != null ? jobOffer.getCreatedBy().getUsername() : null;
        this.candidatesCount = (long) (jobOffer.getCandidates() != null ? jobOffer.getCandidates().size() : 0);
    }
}

