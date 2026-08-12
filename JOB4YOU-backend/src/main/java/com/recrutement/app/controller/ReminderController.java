package com.recrutement.app.controller;

import com.recrutement.app.dto.ReminderResponse;
import com.recrutement.app.service.ReminderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/reminders")
@Tag(name = "Reminders", description = "Rappels automatiques (entretiens)")
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
public class ReminderController {

    @Autowired
    private ReminderService reminderService;

    @GetMapping
    @Operation(summary = "Lister tous les rappels")
    public ResponseEntity<List<ReminderResponse>> getAll() {
        return ResponseEntity.ok(reminderService.getAll().stream()
                .map(ReminderResponse::new)
                .collect(Collectors.toList()));
    }

    @GetMapping("/today")
    @Operation(summary = "Rappels prévus aujourd'hui (widget dashboard)")
    public ResponseEntity<List<ReminderResponse>> getTodayReminders() {
        return ResponseEntity.ok(reminderService.getTodayReminders().stream()
                .map(ReminderResponse::new)
                .collect(Collectors.toList()));
    }
}
