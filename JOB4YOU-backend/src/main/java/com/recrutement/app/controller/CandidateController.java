package com.recrutement.app.controller;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.service.CandidateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/candidates")
@Tag(name = "Candidates", description = "API pour la gestion des candidats")
public class CandidateController {

    @Autowired
    private CandidateService candidateService;

    @PostMapping("/apply")
    @Operation(summary = "Soumettre une candidature", description = "Permet à un candidat de postuler à une offre d'emploi avec son CV")
    public ResponseEntity<?> submitApplication(
            @Parameter(description = "Données de la candidature")
            @RequestParam("application") String applicationJson,
            @Parameter(description = "Fichier CV (PDF, DOC, DOCX)")
            @RequestParam("cv") MultipartFile cvFile) {
        System.out.println("[LOG] POST /api/candidates/apply appelé");
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ApplicationRequest applicationRequest = objectMapper.readValue(applicationJson, ApplicationRequest.class);
            System.out.println("[LOG] Données application reçues : " + applicationJson);
            CandidateResponse response = candidateService.submitApplication(applicationRequest, cvFile);
            System.out.println("[LOG] Candidature créée avec succès");
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            System.out.println("[LOG] Erreur lors de la soumission de la candidature : " + e.getMessage());
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur lors de la soumission de la candidature: " + e.getMessage()));
        }
    }

    @GetMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer tous les candidats", description = "Récupère tous les candidats avec pagination")
    public ResponseEntity<List<CandidateResponse>> getAllCandidates(
            @Parameter(description = "Numéro de page (commence à 0)")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de la page")
            @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Champ de tri")
            @RequestParam(defaultValue = "applicationDate") String sortBy,
            @Parameter(description = "Direction du tri (asc ou desc)")
            @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
            Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<CandidateResponse> candidatesPage = candidateService.getAllCandidates(pageable);
        return ResponseEntity.ok(candidatesPage.getContent());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer un candidat par ID")
    public ResponseEntity<CandidateResponse> getCandidateById(@PathVariable Long id) {
        CandidateResponse response = candidateService.getCandidateById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour un candidat")
    public ResponseEntity<CandidateResponse> updateCandidate(
            @PathVariable Long id,
            @Valid @RequestBody CandidateRequest candidateRequest) {
        CandidateResponse response = candidateService.updateCandidate(id, candidateRequest);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Supprimer un candidat")
    public ResponseEntity<MessageResponse> deleteCandidate(@PathVariable Long id) {
        candidateService.deleteCandidate(id);
        return ResponseEntity.ok(new MessageResponse("Candidat supprimé avec succès"));
    }

    @GetMapping("/job-offer/{jobOfferId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les candidats d'une offre d'emploi")
    public ResponseEntity<List<CandidateResponse>> getCandidatesByJobOffer(
            @PathVariable Long jobOfferId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("applicationDate").descending());
        Page<CandidateResponse> candidatesPage = candidateService.getCandidatesByJobOffer(jobOfferId, pageable);
        return ResponseEntity.ok(candidatesPage.getContent());
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer les candidats par statut")
    public ResponseEntity<List<CandidateResponse>> getCandidatesByStatus(
            @PathVariable Candidate.CandidateStatus status) {
        List<CandidateResponse> response = candidateService.getCandidatesByStatus(status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Rechercher des candidats par nom")
    public ResponseEntity<List<CandidateResponse>> searchCandidatesByName(
            @Parameter(description = "Nom à rechercher")
            @RequestParam String name) {
        List<CandidateResponse> response = candidateService.searchCandidatesByName(name);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour le statut d'un candidat")
    public ResponseEntity<CandidateResponse> updateCandidateStatus(
            @PathVariable Long id,
            @Parameter(description = "Nouveau statut")
            @RequestParam Candidate.CandidateStatus status) {
        CandidateResponse response = candidateService.updateCandidateStatus(id, status);
        return ResponseEntity.ok(response);
    }

    /**
     * Récupère les candidatures d'un utilisateur par son email
     */
    @GetMapping("/by-email/{email}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN') or hasRole('HR')")
    @Operation(summary = "Récupérer les candidatures par email", description = "Récupère toutes les candidatures d'un utilisateur par son email")
    public ResponseEntity<List<CandidateResponse>> getCandidatesByEmail(
            @Parameter(description = "Email de l'utilisateur")
            @PathVariable String email) {
        List<CandidateResponse> candidates = candidateService.getCandidatesByEmail(email);
        return ResponseEntity.ok(candidates);
    }
}

