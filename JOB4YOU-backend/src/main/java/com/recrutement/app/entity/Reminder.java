package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "reminders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "reminder_date", nullable = false)
    private LocalDateTime reminderDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "related_type")
    private RelatedType relatedType;

    @Column(name = "related_id")
    private Long relatedId;

    @Column(name = "is_sent")
    private boolean sent = false;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum RelatedType {
        CANDIDATE, INTERVIEW
    }
}
