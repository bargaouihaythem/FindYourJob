package com.recrutement.app.dto;

import com.recrutement.app.entity.Feedback;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackRequest {

    @NotBlank(message = "Le contenu est obligatoire")
    private String content;

    @Min(value = 1, message = "La note doit être entre 1 et 5")
    @Max(value = 5, message = "La note doit être entre 1 et 5")
    private Integer rating;

    @NotNull(message = "Le type de feedback est obligatoire")
    private Feedback.FeedbackType type;

    private Feedback.FeedbackStatus status;

    private Boolean isSentToCandidate;

    @NotNull(message = "L'ID du candidat est obligatoire")
    private Long candidateId;

    private Long interviewId;
}

