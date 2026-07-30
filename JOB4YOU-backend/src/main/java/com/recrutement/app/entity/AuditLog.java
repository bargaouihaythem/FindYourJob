package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Trace "qui a fait quoi, quand" sur les entités métier (candidat, entretien...).
 * Alimentée manuellement depuis les services (pas d'AOP) pour rester simple
 * et explicite sur les points d'audit réellement pertinents.
 */
@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false)
    private String entityType; // ex: CANDIDATE, INTERVIEW

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(nullable = false)
    private String action; // ex: STATUS_CHANGE, SCORE_OVERRIDE, INTERVIEW_SCHEDULED

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "performed_by")
    private String performedBy;

    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt;

    @PrePersist
    protected void onCreate() {
        performedAt = LocalDateTime.now();
    }
}
