package com.recrutement.app.controller;

import com.recrutement.app.dto.FeedbackRequest;
import com.recrutement.app.dto.FeedbackResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.dto.DetailedNotificationRequest;
import com.recrutement.app.entity.Feedback;
import com.recrutement.app.service.FeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/feedbacks")
@Tag(name = "Feedbacks", description = "API pour la gestion des feedbacks")
public class FeedbackController {

    @Autowired
    private FeedbackService feedbackService;

    @PostMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Créer un nouveau feedback")
    public ResponseEntity<FeedbackResponse> createFeedback(
            @Valid @RequestBody FeedbackRequest feedbackRequest,
            Authentication authentication) {
        FeedbackResponse response = feedbackService.createFeedback(feedbackRequest, authentication.getName());
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer tous les feedbacks")
    public ResponseEntity<List<FeedbackResponse>> getAllFeedbacks() {
        List<FeedbackResponse> response = feedbackService.getAllFeedbacks();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer un feedback par ID")
    public ResponseEntity<FeedbackResponse> getFeedbackById(@PathVariable Long id) {
        FeedbackResponse response = feedbackService.getFeedbackById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour un feedback")
    public ResponseEntity<FeedbackResponse> updateFeedback(
            @PathVariable Long id,
            @Valid @RequestBody FeedbackRequest feedbackRequest) {
        FeedbackResponse response = feedbackService.updateFeedback(id, feedbackRequest);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Supprimer un feedback")
    public ResponseEntity<MessageResponse> deleteFeedback(@PathVariable Long id) {
        feedbackService.deleteFeedback(id);
        return ResponseEntity.ok(new MessageResponse("Feedback supprimé avec succès"));
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks d'un candidat")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByCandidate(@PathVariable Long candidateId) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByCandidate(candidateId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/author/{authorId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks d'un auteur")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByAuthor(@PathVariable Long authorId) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByAuthor(authorId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/interview/{interviewId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks d'un entretien")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByInterview(@PathVariable Long interviewId) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByInterview(interviewId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/type/{type}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks par type")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByType(
            @PathVariable Feedback.FeedbackType type) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByType(type);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks par statut")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByStatus(
            @PathVariable Feedback.FeedbackStatus status) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByStatus(status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/sent-status/{isSent}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks par statut d'envoi")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksBySentStatus(
            @PathVariable Boolean isSent) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksBySentStatus(isSent);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/candidate/{candidateId}/type/{type}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks d'un candidat par type")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByCandidateAndType(
            @PathVariable Long candidateId,
            @PathVariable Feedback.FeedbackType type) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByCandidateAndType(candidateId, type);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/job-offer/{jobOfferId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks d'une offre d'emploi")
    public ResponseEntity<List<FeedbackResponse>> getFeedbacksByJobOffer(@PathVariable Long jobOfferId) {
        List<FeedbackResponse> response = feedbackService.getFeedbacksByJobOffer(jobOfferId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Approuver un feedback")
    public ResponseEntity<FeedbackResponse> approveFeedback(@PathVariable Long id) {
        FeedbackResponse response = feedbackService.approveFeedback(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Rejeter un feedback")
    public ResponseEntity<FeedbackResponse> rejectFeedback(@PathVariable Long id) {
        FeedbackResponse response = feedbackService.rejectFeedback(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/mark-sent")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Marquer un feedback comme envoyé")
    public ResponseEntity<FeedbackResponse> markFeedbackAsSent(@PathVariable Long id) {
        FeedbackResponse response = feedbackService.markFeedbackAsSent(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour le statut d'un feedback")
    public ResponseEntity<FeedbackResponse> updateFeedbackStatus(
            @PathVariable Long id,
            @Parameter(description = "Nouveau statut")
            @RequestParam Feedback.FeedbackStatus status) {
        FeedbackResponse response = feedbackService.updateFeedbackStatus(id, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/pending")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks en attente d'approbation")
    public ResponseEntity<List<FeedbackResponse>> getPendingFeedbacks() {
        List<FeedbackResponse> response = feedbackService.getPendingFeedbacks();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/approved-not-sent")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les feedbacks approuvés mais non envoyés")
    public ResponseEntity<List<FeedbackResponse>> getApprovedNotSentFeedbacks() {
        List<FeedbackResponse> response = feedbackService.getApprovedNotSentFeedbacks();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/send-to-candidate")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Envoyer un feedback au candidat par e-mail")
    public ResponseEntity<MessageResponse> sendFeedbackToCandidate(@PathVariable Long id) {
        feedbackService.sendFeedbackToCandidate(id);
        return ResponseEntity.ok(new MessageResponse("Feedback envoyé au candidat avec succès"));
    }

    @PostMapping("/{id}/send-detailed-notification")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Envoyer une notification détaillée au candidat")
    public ResponseEntity<MessageResponse> sendDetailedNotification(
            @PathVariable Long id,
            @RequestBody DetailedNotificationRequest request) {
        feedbackService.sendDetailedNotification(id, request);
        return ResponseEntity.ok(new MessageResponse("Notification détaillée envoyée avec succès"));
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Récupérer les statistiques des feedbacks")
    public ResponseEntity<Object> getFeedbackStatistics() {
        Object stats = feedbackService.getFeedbackStatistics();
        return ResponseEntity.ok(stats);
    }
}

