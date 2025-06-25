package com.recrutement.app.dto;

import com.recrutement.app.entity.Interview;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InterviewRequest {

    @NotNull(message = "La date de l'entretien est obligatoire")
    private LocalDateTime interviewDate;

    @NotNull(message = "Le type d'entretien est obligatoire")
    private Interview.InterviewType type;

    private Interview.InterviewStatus status;

    private String notes;

    private Integer durationMinutes;

    private String location;

    @NotNull(message = "L'ID du candidat est obligatoire")
    private Long candidateId;

    @NotNull(message = "L'ID de l'interviewer est obligatoire")
    private Long interviewerId;
}

