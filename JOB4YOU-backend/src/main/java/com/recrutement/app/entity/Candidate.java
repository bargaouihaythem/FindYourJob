package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "candidates", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"email", "job_offer_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String email;

    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "linkedin_profile")
    private String linkedinProfile;

    @Column(name = "cover_letter", columnDefinition = "TEXT")
    private String coverLetter;

    @Enumerated(EnumType.STRING)
    private CandidateStatus status = CandidateStatus.APPLIED;

    @Column(name = "application_date")
    private LocalDateTime applicationDate;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    @Column(name = "ai_score")
    private Integer aiScore;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "ai_recommendation")
    private String aiRecommendation;

    // ── Score IA par critères (technique / communication / séniorité) ──
    @Column(name = "ai_score_technical")
    private Integer aiScoreTechnical;

    @Column(name = "ai_score_communication")
    private Integer aiScoreCommunication;

    @Column(name = "ai_score_seniority_match")
    private Integer aiScoreSeniorityMatch;

    /** "COHERE" si calculé via l'API Cohere, "SIMULATED" en mode dégradé (fallback) */
    @Column(name = "ai_score_source")
    private String aiScoreSource;

    // ── Correction manuelle du score IA par le RH ──
    @Column(name = "manual_score")
    private Integer manualScore;

    @Column(name = "manual_score_reason", columnDefinition = "TEXT")
    private String manualScoreReason;

    @Column(name = "manual_score_by")
    private String manualScoreBy;

    @Column(name = "manual_score_date")
    private LocalDateTime manualScoreDate;

    // Relation avec l'offre d'emploi (nullable pour permettre les candidats sans offre spécifique, comme pour l'amélioration de CV)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_offer_id", nullable = true)
    private JobOffer jobOffer;

    // Relation avec le CV
    @OneToOne(mappedBy = "candidate", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private CV cv;

    // Relation avec les entretiens
    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Interview> interviews = new ArrayList<>();

    // Relation avec les feedbacks
    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Feedback> feedbacks = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        applicationDate = LocalDateTime.now();
        lastUpdated = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }

    // Enum pour le statut des candidats
    public enum CandidateStatus {
        APPLIED,              // Candidature soumise
        CV_REVIEWED,          // CV examiné par RH
        PHONE_SCREENING,      // Entretien téléphonique
        TECHNICAL_TEST,       // Test technique
        INTERVIEW,            // Entretien
        FINAL_INTERVIEW,      // Entretien final
        ACCEPTED,             // Accepté (pré-embauche)
        REJECTED,             // Rejeté (générique — rétrocompatibilité)
        AUTO_REJECTED,        // Rejeté automatiquement par l'IA (score < seuil)
        MANAGER_REJECTED,     // Rejeté manuellement par le manager/RH
        INTERVIEW_SCHEDULED,  // Entretien planifié (candidat ACCEPTED → agenda confirmé)
        HIRED,                // Embauché — décision finale positive post-entretien
        WITHDRAWN             // Candidature retirée
    }

	
}

