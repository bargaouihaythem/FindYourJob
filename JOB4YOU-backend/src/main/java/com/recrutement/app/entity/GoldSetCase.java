package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Un cas du Gold Set : un CV de référence dont la bonne décision est connue
 * d'avance (vérité terrain annotée). Sert à calibrer le seuil de décision et à
 * mesurer la qualité de la décision automatique, jamais à scorer un candidat.
 */
@Entity
@Table(name = "gold_set_cases",
        uniqueConstraints = @UniqueConstraint(columnNames = "case_ref"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoldSetCase {

    public enum Relevance {
        PERTINENT,        // la bonne décision est de retenir le dossier
        NON_PERTINENT     // la bonne décision est de l'écarter
    }

    /**
     * REFERENCE : noyau gelé du Gold Set, seul critère de validation d'un seuil.
     * EXTENSION_RH : cas ajouté après coup par le RH (anonymisé, annoté par lui) ;
     * il peut améliorer une calibration, jamais l'autoriser seul.
     */
    public enum Origin {
        REFERENCE,
        EXTENSION_RH
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_ref", nullable = false, length = 32)
    private String caseRef;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "candidate_name", nullable = false)
    private String candidateName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_offer_id", nullable = false)
    private JobOffer jobOffer;

    @Enumerated(EnumType.STRING)
    @Column(name = "ground_truth", nullable = false, length = 16)
    private Relevance groundTruth;

    /** Cas limite : la frontière de décision se joue ici, pas sur les cas francs. */
    @Column(name = "borderline", nullable = false)
    private boolean borderline;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin", nullable = false, length = 16)
    private Origin origin = Origin.EXTENSION_RH;

    @Lob
    @Column(name = "extracted_text", nullable = false)
    private String extractedText;

    @Column(name = "last_score")
    private Integer lastScore;

    @Column(name = "last_score_source", length = 16)
    private String lastScoreSource;

    @Column(name = "last_evaluated_at")
    private LocalDateTime lastEvaluatedAt;

    public boolean expectedRetain() {
        return groundTruth == Relevance.PERTINENT;
    }
}
