package com.recrutement.app.controller;

import com.recrutement.app.dto.AuditLogResponse;
import com.recrutement.app.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/audit")
@Tag(name = "Audit", description = "Historique des actions (qui a fait quoi, quand)")
@PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
public class AuditLogController {

    @Autowired
    private AuditLogService auditLogService;

    @GetMapping("/candidate/{id}")
    @Operation(summary = "Historique d'audit d'un candidat")
    public ResponseEntity<List<AuditLogResponse>> getCandidateHistory(@PathVariable Long id) {
        List<AuditLogResponse> response = auditLogService.getHistory("CANDIDATE", id).stream()
                .map(AuditLogResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent")
    @Operation(summary = "Activité récente (tous types confondus), pour le dashboard admin")
    public ResponseEntity<List<AuditLogResponse>> getRecent(@RequestParam(defaultValue = "50") int limit) {
        List<AuditLogResponse> response = auditLogService.getRecent(limit).stream()
                .map(AuditLogResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}
