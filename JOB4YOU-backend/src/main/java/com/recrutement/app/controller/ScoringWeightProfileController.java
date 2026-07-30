package com.recrutement.app.controller;

import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.dto.ScoringWeightProfileRequest;
import com.recrutement.app.dto.ScoringWeightProfileResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.service.ScoringWeightProfileService;
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
 * Paramétrage RH de la pondération du score IA par famille de métier
 * (CS/ProdOps/RSD/Autre) et niveau de séniorité (Junior/Confirmé/Senior).
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/scoring-profiles")
@Tag(name = "Scoring Profiles", description = "Pondération du score IA par famille de métier et niveau")
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
public class ScoringWeightProfileController {

    @Autowired
    private ScoringWeightProfileService scoringWeightProfileService;

    @GetMapping
    @Operation(summary = "Lister tous les profils de pondération")
    public ResponseEntity<List<ScoringWeightProfileResponse>> listAll() {
        return ResponseEntity.ok(scoringWeightProfileService.listAll());
    }

    @PutMapping("/{jobFamily}/{seniorityLevel}")
    @Operation(summary = "Créer ou mettre à jour la pondération d'une combinaison famille/niveau")
    public ResponseEntity<?> upsert(
            @PathVariable JobOffer.JobFamily jobFamily,
            @PathVariable JobOffer.SeniorityLevel seniorityLevel,
            @Valid @RequestBody ScoringWeightProfileRequest request,
            Authentication authentication) {
        try {
            String updatedBy = authentication != null ? authentication.getName() : "RH";
            ScoringWeightProfileResponse response = scoringWeightProfileService.upsert(
                    jobFamily, seniorityLevel, request, updatedBy);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }
}
