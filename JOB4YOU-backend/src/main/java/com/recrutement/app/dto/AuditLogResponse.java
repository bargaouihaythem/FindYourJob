package com.recrutement.app.dto;

import com.recrutement.app.entity.AuditLog;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private Long id;
    private String entityType;
    private Long entityId;
    private String action;
    private String oldValue;
    private String newValue;
    private String performedBy;
    private LocalDateTime performedAt;

    public AuditLogResponse(AuditLog log) {
        this.id = log.getId();
        this.entityType = log.getEntityType();
        this.entityId = log.getEntityId();
        this.action = log.getAction();
        this.oldValue = log.getOldValue();
        this.newValue = log.getNewValue();
        this.performedBy = log.getPerformedBy();
        this.performedAt = log.getPerformedAt();
    }
}
