package com.recrutement.app.controller;

import com.recrutement.app.dto.InternalNoteRequest;
import com.recrutement.app.dto.InternalNoteResponse;
import com.recrutement.app.service.InternalNoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Notes internes RH/Admin sur un candidat : jamais exposées au candidat
 * (à la différence des Feedback, potentiellement formalisés/envoyés).
 */

@RestController
@RequestMapping("/api/internal-notes")
@Tag(name = "Internal Notes", description = "Notes internes RH/Admin sur les candidats")
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
public class InternalNoteController {

    @Autowired
    private InternalNoteService internalNoteService;

    @PostMapping
    @Operation(summary = "Créer une note interne")
    public ResponseEntity<InternalNoteResponse> createNote(
            @Valid @RequestBody InternalNoteRequest request,
            Authentication authentication) {
        InternalNoteResponse response = internalNoteService.createNote(request, authentication.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/candidate/{candidateId}")
    @Operation(summary = "Lister les notes internes d'un candidat")
    public ResponseEntity<List<InternalNoteResponse>> getNotesForCandidate(@PathVariable Long candidateId) {
        return ResponseEntity.ok(internalNoteService.getNotesForCandidate(candidateId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier une note interne")
    public ResponseEntity<InternalNoteResponse> updateNote(
            @PathVariable Long id,
            @Valid @RequestBody InternalNoteRequest request) {
        return ResponseEntity.ok(internalNoteService.updateNote(id, request.getContent()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une note interne")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        internalNoteService.deleteNote(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/pin")
    @Operation(summary = "Épingler / désépingler une note interne")
    public ResponseEntity<InternalNoteResponse> togglePin(@PathVariable Long id) {
        return ResponseEntity.ok(internalNoteService.togglePin(id));
    }
}
