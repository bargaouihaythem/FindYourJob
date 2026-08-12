package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "n8n_outbox_events", indexes = {
        @Index(name = "idx_n8n_outbox_status_next_attempt", columnList = "status,next_attempt_at")
})
@Getter
@Setter
@NoArgsConstructor
public class N8nOutboxEvent {

    public enum Status {
        PENDING, SENT, FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_key", nullable = false, unique = true, length = 180)
    private String eventKey;

    @Column(name = "webhook_url", nullable = false, length = 500)
    private String webhookUrl;

    @Column(name = "agent_name", nullable = false, length = 120)
    private String agentName;

    @Lob
    @Column(name = "payload_json", nullable = false)
    private String payloadJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    public N8nOutboxEvent(String eventKey, String webhookUrl, String agentName,
                          String payloadJson, LocalDateTime now) {
        this.eventKey = eventKey;
        this.webhookUrl = webhookUrl;
        this.agentName = agentName;
        this.payloadJson = payloadJson;
        this.status = Status.PENDING;
        this.nextAttemptAt = now;
        this.createdAt = now;
    }
}
