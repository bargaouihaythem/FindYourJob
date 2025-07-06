package com.recrutement.app.controller;

import com.recrutement.app.dto.EmailRequest;
import com.recrutement.app.dto.EmailResponse;
import com.recrutement.app.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "API pour la gestion des notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    /**
     * Envoie un email personnalisé
     */
    @PostMapping("/custom-email")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Envoyer un email personnalisé")
    public ResponseEntity<EmailResponse> sendCustomEmail(
            @RequestBody EmailRequest emailRequest) {
        try {
            notificationService.sendCustomEmail(
                emailRequest.getTo(),
                emailRequest.getSubject(),
                emailRequest.getContent(),
                emailRequest.isHtml()
            );            return ResponseEntity.ok(new EmailResponse(true, "Email envoyé avec succès"));
        } catch (Exception e) {
            return ResponseEntity.ok(new EmailResponse(false, "Erreur lors de l'envoi de l'email: " + e.getMessage()));
        }
    }
}
