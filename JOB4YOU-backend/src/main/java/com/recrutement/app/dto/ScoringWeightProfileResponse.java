package com.recrutement.app.dto;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScoringWeightProfileResponse {

    private Long id;
    private JobOffer.JobFamily jobFamily;
    private JobOffer.SeniorityLevel seniorityLevel;
    private double weightTechnical;
    private double weightCommunication;
    private double weightSeniority;
    private Integer decisionThreshold;
    private Double calibratedF1;
    private LocalDateTime calibratedAt;
    private String updatedBy;
    private LocalDateTime updatedAt;

    public ScoringWeightProfileResponse(ScoringWeightProfile profile) {
        this.id = profile.getId();
        this.jobFamily = profile.getJobFamily();
        this.seniorityLevel = profile.getSeniorityLevel();
        this.weightTechnical = profile.getWeightTechnical();
        this.weightCommunication = profile.getWeightCommunication();
        this.weightSeniority = profile.getWeightSeniority();
        this.decisionThreshold = profile.getDecisionThreshold();
        this.calibratedF1 = profile.getCalibratedF1();
        this.calibratedAt = profile.getCalibratedAt();
        this.updatedBy = profile.getUpdatedBy();
        this.updatedAt = profile.getUpdatedAt();
    }
}
