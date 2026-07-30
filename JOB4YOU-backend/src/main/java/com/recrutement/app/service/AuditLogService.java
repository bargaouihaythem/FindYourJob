package com.recrutement.app.service;

import com.recrutement.app.entity.AuditLog;
import com.recrutement.app.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    public void log(String entityType, Long entityId, String action, Object oldValue, Object newValue) {
        AuditLog entry = new AuditLog();
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setAction(action);
        entry.setOldValue(oldValue != null ? oldValue.toString() : null);
        entry.setNewValue(newValue != null ? newValue.toString() : null);
        entry.setPerformedBy(currentUsername());
        auditLogRepository.save(entry);
    }

    public List<AuditLog> getHistory(String entityType, Long entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByPerformedAtDesc(entityType, entityId);
    }

    public List<AuditLog> getRecent(int limit) {
        return auditLogRepository.findRecent(PageRequest.of(0, limit));
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            return "n8n / système";
        }
        return authentication.getName();
    }
}
