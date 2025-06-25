package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "feedbacks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "rating")
    private Integer rating; // Note sur 5 ou 10

    @Enumerated(EnumType.STRING)
    private FeedbackType type;

    @Enumerated(EnumType.STRING)
    private FeedbackStatus status = FeedbackStatus.PENDING;

    @Column(name = "is_sent_to_candidate")
    private Boolean isSentToCandidate = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    // Relation avec le candidat
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    // Relation avec l'auteur du feedback (utilisateur)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    // Relation avec l'entretien (optionnel)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id")
    private Interview interview;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Enum pour les types de feedback
    public enum FeedbackType {
        CV_REVIEW,          // Évaluation du CV
        PHONE_SCREENING,    // Feedback entretien téléphonique
        TECHNICAL_TEST,     // Feedback test technique
        INTERVIEW,          // Feedback entretien
        FINAL_DECISION,     // Décision finale
        GENERAL             // Feedback général
    }

    // Enum pour le statut des feedbacks
    public enum FeedbackStatus {
        PENDING,            // En attente
        APPROVED,           // Approuvé
        REJECTED,           // Rejeté
        SENT,               // Envoyé au candidat
        ARCHIVED            // Archivé
    }
}

