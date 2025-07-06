package com.recrutement.app.controller;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.dto.JobOfferResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.service.JobOfferService;
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
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/job-offers")
@Tag(name = "Job Offers", description = "API pour la gestion des offres d'emploi")
public class JobOfferController {

    @Autowired
    private JobOfferService jobOfferService;

    @PostMapping
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Créer une nouvelle offre d'emploi", description = "Seuls les RH et les administrateurs peuvent créer des offres")
    public ResponseEntity<JobOfferResponse> createJobOffer(
            @Valid @RequestBody JobOfferRequest jobOfferRequest,
            Authentication authentication) {
        JobOfferResponse response = jobOfferService.createJobOffer(jobOfferRequest, authentication.getName());
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Récupérer toutes les offres d'emploi", description = "Récupère toutes les offres d'emploi avec pagination optionnelle")
    public ResponseEntity<List<JobOfferResponse>> getAllJobOffers(
            @Parameter(description = "Numéro de page (commence à 0)")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de la page")
            @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Champ de tri")
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Direction du tri (asc ou desc)")
            @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
            Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<JobOfferResponse> jobOffersPage = jobOfferService.getAllJobOffers(pageable);
        return ResponseEntity.ok(jobOffersPage.getContent());
    }

    @GetMapping("/public")
    @Operation(summary = "Récupérer les offres d'emploi publiques", description = "Récupère les offres d'emploi actives pour les candidats")
    public ResponseEntity<List<JobOfferResponse>> getPublicJobOffers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<JobOfferResponse> jobOffersPage = jobOfferService.getJobOffersByStatus(JobOffer.JobStatus.ACTIVE, pageable);
        return ResponseEntity.ok(jobOffersPage.getContent());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Récupérer une offre d'emploi par ID")
    public ResponseEntity<JobOfferResponse> getJobOfferById(@PathVariable Long id) {
        JobOfferResponse response = jobOfferService.getJobOfferById(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/public/{id}")
    @Operation(summary = "Récupérer une offre d'emploi publique par ID", description = "Récupère les détails d'une offre d'emploi active pour les visiteurs non connectés")
    public ResponseEntity<JobOfferResponse> getPublicJobOfferById(@PathVariable Long id) {
        try {
            JobOfferResponse response = jobOfferService.getJobOfferById(id);
            
            // Vérifier que l'offre est active et peut être consultée publiquement
            if (response.getStatus() != JobOffer.JobStatus.ACTIVE) {
                return ResponseEntity.notFound().build();
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Mettre à jour une offre d'emploi")
    public ResponseEntity<JobOfferResponse> updateJobOffer(
            @PathVariable Long id,
            @Valid @RequestBody JobOfferRequest jobOfferRequest) {
        JobOfferResponse response = jobOfferService.updateJobOffer(id, jobOfferRequest);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Supprimer une offre d'emploi")
    public ResponseEntity<MessageResponse> deleteJobOffer(@PathVariable Long id) {
        jobOfferService.deleteJobOffer(id);
        return ResponseEntity.ok(new MessageResponse("Offre d'emploi supprimée avec succès"));
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Récupérer les offres d'emploi par statut")
    public ResponseEntity<List<JobOfferResponse>> getJobOffersByStatus(
            @PathVariable JobOffer.JobStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<JobOfferResponse> jobOffersPage = jobOfferService.getJobOffersByStatus(status, pageable);
        return ResponseEntity.ok(jobOffersPage.getContent());
    }

    @GetMapping("/search")
    @Operation(summary = "Rechercher des offres d'emploi par mot-clé")
    public ResponseEntity<List<JobOfferResponse>> searchJobOffers(
            @Parameter(description = "Mot-clé de recherche")
            @RequestParam String keyword) {
        List<JobOfferResponse> response = jobOfferService.searchJobOffers(keyword);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search/location")
    @Operation(summary = "Rechercher des offres d'emploi par localisation")
    public ResponseEntity<List<JobOfferResponse>> searchJobOffersByLocation(
            @Parameter(description = "Localisation")
            @RequestParam String location) {
        List<JobOfferResponse> response = jobOfferService.searchJobOffersByLocation(location);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my-offers")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Récupérer mes offres d'emploi")
    public ResponseEntity<List<JobOfferResponse>> getMyJobOffers(Authentication authentication) {
        // Récupérer l'ID de l'utilisateur connecté
        // Cette implémentation nécessiterait d'adapter le service pour récupérer par username
        List<JobOfferResponse> response = jobOfferService.getAllJobOffers(); // Temporaire
        return ResponseEntity.ok(response);
    }

    @GetMapping("/expired")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Récupérer les offres d'emploi expirées")
    public ResponseEntity<List<JobOfferResponse>> getExpiredJobOffers() {
        List<JobOfferResponse> response = jobOfferService.getExpiredJobOffers();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/contract-type/{contractType}")
    @Operation(summary = "Récupérer les offres d'emploi par type de contrat")
    public ResponseEntity<List<JobOfferResponse>> getJobOffersByContractType(
            @PathVariable String contractType,
            @RequestParam(defaultValue = "ACTIVE") JobOffer.JobStatus status) {
        List<JobOfferResponse> response = jobOfferService.getJobOffersByContractTypeAndStatus(contractType, status);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Changer le statut d'une offre d'emploi")
    public ResponseEntity<MessageResponse> updateJobOfferStatus(
            @PathVariable Long id,
            @Parameter(description = "Nouveau statut (ACTIVE, CLOSED, DRAFT, EXPIRED)")
            @RequestParam JobOffer.JobStatus status) {
        jobOfferService.updateJobOfferStatus(id, status);
        return ResponseEntity.ok(new MessageResponse("Statut de l'offre d'emploi mis à jour avec succès"));
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Récupérer les statistiques des offres d'emploi")
    public ResponseEntity<Object> getJobOfferStatistics() {
        Object stats = jobOfferService.getJobOfferStatistics();
        return ResponseEntity.ok(stats);
    }
}

