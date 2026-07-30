package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Pondération du score IA (technique/communication/séniorité) paramétrable
 * par le RH pour chaque combinaison famille de métier × niveau de séniorité.
 * Une seule ligne par combinaison (JobOffer.JobFamily, JobOffer.SeniorityLevel).
 */
@Entity
@Table(name = "scoring_weight_profiles",
        uniqueConstraints = @UniqueConstraint(columnNames = {"job_family", "seniority_level"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScoringWeightProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_family", nullable = false)
    private JobOffer.JobFamily jobFamily;

    @Enumerated(EnumType.STRING)
    @Column(name = "seniority_level", nullable = false)
    private JobOffer.SeniorityLevel seniorityLevel;

    @Column(name = "weight_technical", nullable = false)
    private double weightTechnical;

    @Column(name = "weight_communication", nullable = false)
    private double weightCommunication;

    @Column(name = "weight_seniority", nullable = false)
    private double weightSeniority;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        updatedAt = LocalDateTime.now();
    }
}
