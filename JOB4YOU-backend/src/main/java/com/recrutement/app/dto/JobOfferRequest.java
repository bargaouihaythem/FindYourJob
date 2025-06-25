package com.recrutement.app.dto;

import com.recrutement.app.entity.JobOffer;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobOfferRequest {

    @NotBlank(message = "Le titre est obligatoire")
    private String title;

    private String description;

    private String requiredSkills;

    private String experienceLevel;

    private String contractType;

    private String location;

    private String salaryRange;

    private JobOffer.JobStatus status;

    @NotNull(message = "La date limite est obligatoire")
    private LocalDateTime deadline;
}

