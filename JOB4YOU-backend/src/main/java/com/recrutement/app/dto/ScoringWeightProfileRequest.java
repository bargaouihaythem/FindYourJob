package com.recrutement.app.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * La famille de métier et le niveau de séniorité sont portés par l'URL
 * (PUT /api/scoring-profiles/{jobFamily}/{seniorityLevel}), pas par le corps.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScoringWeightProfileRequest {

    @NotNull(message = "Le poids technique est obligatoire")
    @DecimalMin(value = "0.0", message = "Le poids technique doit être >= 0")
    @DecimalMax(value = "1.0", message = "Le poids technique doit être <= 1")
    private Double weightTechnical;

    @NotNull(message = "Le poids communication est obligatoire")
    @DecimalMin(value = "0.0", message = "Le poids communication doit être >= 0")
    @DecimalMax(value = "1.0", message = "Le poids communication doit être <= 1")
    private Double weightCommunication;

    @NotNull(message = "Le poids séniorité est obligatoire")
    @DecimalMin(value = "0.0", message = "Le poids séniorité doit être >= 0")
    @DecimalMax(value = "1.0", message = "Le poids séniorité doit être <= 1")
    private Double weightSeniority;
}
