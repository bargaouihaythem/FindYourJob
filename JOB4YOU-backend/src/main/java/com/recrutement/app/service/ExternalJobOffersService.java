package com.recrutement.app.service;

import com.recrutement.app.dto.ExternalJobOfferResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Intégration d'offres d'emploi externes pour étude comparative du marché.
 *
 * Source : Remotive (https://remotive.com/api/remote-jobs) — API publique,
 * gratuite, sans clé ni inscription requise, conforme à ses conditions
 * d'utilisation (endpoint prévu pour un usage programmatique public).
 *
 * ⚠️ Le scraping de LinkedIn n'est PAS implémenté : LinkedIn interdit
 * contractuellement le scraping automatisé de son site (conditions
 * d'utilisation), ce qui expose à un bannissement de compte et à un risque
 * juridique. Pour une intégration LinkedIn légale, il faudrait passer par
 * l'API officielle LinkedIn Talent Solutions (partenariat payant).
 */
@Service
public class ExternalJobOffersService {

    private static final Logger log = LoggerFactory.getLogger(ExternalJobOffersService.class);
    private static final String REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs";

    private final RestTemplate restTemplate;

    public ExternalJobOffersService(@Qualifier("huggingFaceRestTemplate") RestTemplate restTemplate) {
        // Réutilise le RestTemplate générique (timeouts configurés), pas de lien fonctionnel avec HuggingFace
        this.restTemplate = restTemplate;
    }

    @SuppressWarnings("unchecked")
    public List<ExternalJobOfferResponse> searchRemoteOffers(String search, Integer limit) {
        List<ExternalJobOfferResponse> result = new ArrayList<>();

        String url = UriComponentsBuilder.fromHttpUrl(REMOTIVE_API_URL)
                .queryParamIfPresent("search", java.util.Optional.ofNullable(search))
                .queryParamIfPresent("limit", java.util.Optional.ofNullable(limit))
                .toUriString();

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null || !response.containsKey("jobs")) {
                log.warn("[ExternalJobOffers] Réponse Remotive invalide");
                return result;
            }

            List<Map<String, Object>> jobs = (List<Map<String, Object>>) response.get("jobs");
            for (Map<String, Object> job : jobs) {
                ExternalJobOfferResponse dto = new ExternalJobOfferResponse();
                dto.setSource("REMOTIVE");
                dto.setExternalId(String.valueOf(job.get("id")));
                dto.setTitle((String) job.get("title"));
                dto.setCompanyName((String) job.get("company_name"));
                dto.setCategory((String) job.get("category"));
                dto.setJobType((String) job.get("job_type"));
                dto.setCandidateRequiredLocation((String) job.get("candidate_required_location"));
                dto.setSalary((String) job.get("salary"));
                dto.setUrl((String) job.get("url"));
                dto.setPublicationDate((String) job.get("publication_date"));
                result.add(dto);
            }
        } catch (Exception e) {
            log.warn("[ExternalJobOffers] Appel Remotive échoué : {}", e.getMessage());
        }

        return result;
    }
}
