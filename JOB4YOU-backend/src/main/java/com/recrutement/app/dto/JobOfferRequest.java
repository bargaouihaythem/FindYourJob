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

    private JobOffer.JobFamily jobFamily;

    private JobOffer.SeniorityLevel seniorityLevel;

    private String contractType;

    private String location;

    private String salaryRange;

    private JobOffer.JobStatus status;

    @NotNull(message = "La date limite est obligatoire")
    private LocalDateTime deadline;

    private String managerEmail;

    private Long departmentId;

    /**
     * Manager recruteur désigné par le RH. C'est le premier niveau de l'aiguillage :
     * quand il est renseigné, les dossiers de l'offre partent chez lui, et personne
     * d'autre. Le champ reste nullable pour les offres historiques.
     */
    private Long hiringManagerId;

    /** Assume un manager recruteur hors du département de l'offre ; tracé dans le journal d'audit. */
    private Boolean allowManagerDepartmentMismatch;
}

