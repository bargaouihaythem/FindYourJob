package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "candidates")
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

    @Column(nullable = false, unique = true)
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
        APPLIED,           // Candidature soumise
        CV_REVIEWED,       // CV examiné
        PHONE_SCREENING,   // Entretien téléphonique
        TECHNICAL_TEST,    // Test technique
        INTERVIEW,         // Entretien
        FINAL_INTERVIEW,   // Entretien final
        ACCEPTED,          // Accepté
        REJECTED,          // Rejeté
        WITHDRAWN          // Candidature retirée
    }

	
}

