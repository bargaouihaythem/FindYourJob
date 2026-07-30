package com.recrutement.app.service;

import com.recrutement.app.dto.JobMatchResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.repository.JobOfferRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Matching "inverse" : à partir du texte d'un CV, suggère les offres actives
 * les mieux adaptées.
 *
 * Deux étapes :
 *  1. Pré-filtrage rapide par mots-clés sur TOUTES les offres actives (gratuit,
 *     instantané) pour retenir un lot restreint de candidates.
 *  2. Affinage par Cohere sur ce lot restreint (un seul appel IA, pas un par
 *     offre) pour un score réellement sémantique plutôt qu'une simple
 *     correspondance de sous-chaînes.
 *
 * Si Cohere n'est pas configuré ou indisponible, on retombe sur le score par
 * mots-clés (source = SIMULATED), comme pour le scoring des candidatures.
 */
@Service
public class MatchingService {

    private static final Logger log = LoggerFactory.getLogger(MatchingService.class);
    private static final int AI_CANDIDATE_POOL_SIZE = 20;

    @Autowired
    private JobOfferRepository jobOfferRepository;

    @Autowired
    private CohereClient cohereClient;

    public List<JobMatchResponse> suggestOffers(String cvText) {
        String textLower = cvText != null ? cvText.toLowerCase(Locale.ROOT) : "";

        List<JobOffer> activeOffers = jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE);

        // Étape 1 : pré-filtrage par mots-clés sur toutes les offres actives
        List<JobMatchResponse> keywordRanked = activeOffers.stream()
                .map(offer -> new JobMatchResponse(
                        offer.getId(), offer.getTitle(), offer.getLocation(),
                        offer.getContractType(), offer.getRequiredSkills(),
                        computeKeywordScore(textLower, offer.getRequiredSkills()), "SIMULATED"))
                .sorted(Comparator.comparingInt(JobMatchResponse::getMatchScore).reversed())
                .collect(Collectors.toList());

        List<JobMatchResponse> aiPool = keywordRanked.stream()
                .limit(AI_CANDIDATE_POOL_SIZE)
                .collect(Collectors.toList());

        // Étape 2 : affinage IA (Cohere) sur le lot restreint
        try {
            List<CohereClient.OfferSummary> summaries = aiPool.stream()
                    .map(m -> new CohereClient.OfferSummary(m.getJobOfferId(), m.getTitle(), m.getRequiredSkills()))
                    .collect(Collectors.toList());

            Map<Long, Integer> aiScores = cohereClient.rankJobOffers(cvText, summaries);

            for (JobMatchResponse match : aiPool) {
                Integer aiScore = aiScores.get(match.getJobOfferId());
                if (aiScore != null) {
                    match.setMatchScore(aiScore);
                    match.setSource("COHERE");
                }
            }
        } catch (Exception e) {
            log.info("[MatchingService] Mode mots-clés utilisé (Cohere indisponible) : {}", e.getMessage());
        }

        aiPool.sort(Comparator.comparingInt(JobMatchResponse::getMatchScore).reversed());
        return aiPool;
    }

    private int computeKeywordScore(String cvTextLower, String requiredSkills) {
        if (requiredSkills == null || requiredSkills.isBlank() || cvTextLower.isBlank()) {
            return 0;
        }

        List<String> skills = new ArrayList<>();
        for (String s : requiredSkills.split(",")) {
            String trimmed = s.trim();
            if (!trimmed.isEmpty()) skills.add(trimmed.toLowerCase(Locale.ROOT));
        }
        if (skills.isEmpty()) return 0;

        long matched = skills.stream().filter(cvTextLower::contains).count();
        return (int) Math.round((matched * 100.0) / skills.size());
    }
}
