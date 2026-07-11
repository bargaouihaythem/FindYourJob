package com.recrutement.app.controller;

import com.recrutement.app.dto.ExternalJobOfferResponse;
import com.recrutement.app.service.ExternalJobOffersService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Étude comparative du marché de l'emploi (offres externes).
 *
 * Source : Remotive (API publique gratuite). Le scraping LinkedIn n'est pas
 * proposé : contraire à ses conditions d'utilisation (voir ExternalJobOffersService).
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/external-offers")
@Tag(name = "External Offers", description = "Étude comparative des offres d'emploi externes (Remotive)")
public class ExternalJobOffersController {

    @Autowired
    private ExternalJobOffersService externalJobOffersService;

    @GetMapping("/remotive")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Rechercher des offres externes (Remotive)", description = "Étude comparative du marché — source publique et gratuite, sans scraping LinkedIn")
    public ResponseEntity<List<ExternalJobOfferResponse>> searchRemoteOffers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "20") Integer limit) {
        List<ExternalJobOfferResponse> offers = externalJobOffersService.searchRemoteOffers(search, limit);
        return ResponseEntity.ok(offers);
    }
}
