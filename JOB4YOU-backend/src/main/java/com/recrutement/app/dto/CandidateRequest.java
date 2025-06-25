package com.recrutement.app.dto;

import com.recrutement.app.entity.Candidate;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CandidateRequest {

    @NotBlank(message = "Le prénom est obligatoire")
    private String firstName;

    @NotBlank(message = "Le nom est obligatoire")
    private String lastName;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    private String email;

    private String phone;

    private String address;

    private String linkedinProfile;

    private String coverLetter;

    @NotNull(message = "L'ID de l'offre d'emploi est obligatoire")
    private Long jobOfferId;

    private Candidate.CandidateStatus status;
}

