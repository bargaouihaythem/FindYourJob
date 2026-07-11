package com.recrutement.app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Offre d'emploi externe (source : Remotive — API publique gratuite, sans clé).
 * Utilisée pour l'étude comparative du marché (pas de scraping LinkedIn :
 * scraping LinkedIn viole ses conditions d'utilisation).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalJobOfferResponse {
    private String source;          // "REMOTIVE"
    private String externalId;
    private String title;
    private String companyName;
    private String category;
    private String jobType;
    private String candidateRequiredLocation;
    private String salary;
    private String url;
    private String publicationDate;
}
