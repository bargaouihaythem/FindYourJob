package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "interviews")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "interview_date", nullable = false)
    private LocalDateTime interviewDate;

    @Enumerated(EnumType.STRING)
    private InterviewType type;

    @Enumerated(EnumType.STRING)
    private InterviewStatus status = InterviewStatus.SCHEDULED;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    private String location; // Peut être une adresse physique ou un lien de visioconférence

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relation avec le candidat
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    // Relation avec l'interviewer (utilisateur)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_id", nullable = false)
    private User interviewer;

    // Relation avec les feedbacks de cet entretien
    @OneToMany(mappedBy = "interview", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Feedback> feedbacks = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Enum pour les types d'entretien
    public enum InterviewType {
        PHONE_SCREENING,    // Entretien téléphonique
        TECHNICAL,          // Entretien technique
        HR,                 // Entretien RH
        MANAGER,            // Entretien avec le manager
        FINAL,              // Entretien final
        GROUP               // Entretien de groupe
    }

    // Enum pour le statut des entretiens
    public enum InterviewStatus {
        SCHEDULED,          // Planifié
        IN_PROGRESS,        // En cours
        COMPLETED,          // Terminé
        CANCELLED,          // Annulé
        RESCHEDULED         // Reprogrammé
    }
}

