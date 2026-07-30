package com.recrutement.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InternalNoteRequest {

    @NotNull(message = "L'ID du candidat est obligatoire")
    private Long candidateId;

    @NotBlank(message = "Le contenu de la note est obligatoire")
    private String content;
}
