package com.recrutement.app.controller;

import com.recrutement.app.dto.InterviewRequest;
import com.recrutement.app.dto.InterviewResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.service.InterviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/interviews")
@Tag(name = "Interviews", description = "API pour la gestion des entretiens")
public class InterviewController {

    @Autowired
    private InterviewService interviewService;

    @PostMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Planifier un nouvel entretien")
    public ResponseEntity<InterviewResponse> scheduleInterview(
            @Valid @RequestBody InterviewRequest interviewRequest) {
        InterviewResponse response = interviewService.scheduleInterview(interviewRequest);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer tous les entretiens")
    public ResponseEntity<List<InterviewResponse>> getAllInterviews() {
        List<InterviewResponse> response = interviewService.getAllInterviews();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer un entretien par ID")
    public ResponseEntity<InterviewResponse> getInterviewById(@PathVariable Long id) {
        InterviewResponse response = interviewService.getInterviewById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour un entretien")
    public ResponseEntity<InterviewResponse> updateInterview(
            @PathVariable Long id,
            @Valid @RequestBody InterviewRequest interviewRequest) {
        InterviewResponse response = interviewService.updateInterview(id, interviewRequest);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Supprimer un entretien")
    public ResponseEntity<MessageResponse> deleteInterview(@PathVariable Long id) {
        interviewService.deleteInterview(id);
        return ResponseEntity.ok(new MessageResponse("Entretien supprimé avec succès"));
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer les entretiens d'un candidat")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByCandidate(@PathVariable Long candidateId) {
        List<InterviewResponse> response = interviewService.getInterviewsByCandidate(candidateId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/interviewer/{interviewerId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer les entretiens d'un interviewer")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByInterviewer(@PathVariable Long interviewerId) {
        List<InterviewResponse> response = interviewService.getInterviewsByInterviewer(interviewerId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les entretiens par statut")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByStatus(
            @PathVariable Interview.InterviewStatus status) {
        List<InterviewResponse> response = interviewService.getInterviewsByStatus(status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/type/{type}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les entretiens par type")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByType(
            @PathVariable Interview.InterviewType type) {
        List<InterviewResponse> response = interviewService.getInterviewsByType(type);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/date-range")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer les entretiens par période")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByDateRange(
            @Parameter(description = "Date de début (format: yyyy-MM-dd'T'HH:mm:ss)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "Date de fin (format: yyyy-MM-dd'T'HH:mm:ss)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<InterviewResponse> response = interviewService.getInterviewsByDateRange(startDate, endDate);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/interviewer/{interviewerId}/date-range")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer les entretiens d'un interviewer par période")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByInterviewerAndDateRange(
            @PathVariable Long interviewerId,
            @Parameter(description = "Date de début (format: yyyy-MM-dd'T'HH:mm:ss)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "Date de fin (format: yyyy-MM-dd'T'HH:mm:ss)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<InterviewResponse> response = interviewService.getInterviewsByInterviewerAndDateRange(interviewerId, startDate, endDate);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Mettre à jour le statut d'un entretien")
    public ResponseEntity<InterviewResponse> updateInterviewStatus(
            @PathVariable Long id,
            @Parameter(description = "Nouveau statut")
            @RequestParam Interview.InterviewStatus status) {
        InterviewResponse response = interviewService.updateInterviewStatus(id, status);
        return ResponseEntity.ok(response);
    }

    /**
     * Récupère les entretiens d'un candidat par son email
     */
    @GetMapping("/by-email/{email}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN') or hasRole('HR')")
    @Operation(summary = "Récupérer les entretiens par email du candidat")
    public ResponseEntity<List<InterviewResponse>> getInterviewsByEmail(
            @PathVariable String email) {
        List<InterviewResponse> interviews = interviewService.getInterviewsByEmail(email);
        return ResponseEntity.ok(interviews);
    }
}

