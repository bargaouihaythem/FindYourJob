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

        // Déduplication : le jeu de données contient de nombreuses offres identiques
        // (même intitulé + lieu + type de contrat). On n'en garde qu'une par combinaison
        // pour ne pas noyer l'utilisateur sous 13 fois la même annonce.
        List<JobOffer> uniqueOffers = new ArrayList<>(activeOffers.stream()
                .collect(Collectors.toMap(
                        o -> (o.getTitle() + "|" + o.getLocation() + "|" + o.getContractType()).toLowerCase(Locale.ROOT),
                        o -> o,
                        (a, b) -> a,
                        java.util.LinkedHashMap::new))
                .values());

        // Étape 1 : pré-filtrage par mots-clés sur toutes les offres actives (titre + compétences)
        List<JobMatchResponse> keywordRanked = uniqueOffers.stream()
                .map(offer -> new JobMatchResponse(
                        offer.getId(), offer.getTitle(), offer.getLocation(),
                        offer.getContractType(), offer.getRequiredSkills(),
                        computeKeywordScore(textLower, offer.getTitle(), offer.getRequiredSkills()), "SIMULATED"))
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

        // Un score de 0 (mots-clés comme Cohere) signifie "aucun rapport" — inutile de le
        // présenter comme une "suggestion", ça décrédibilise le résultat pour l'utilisateur.
        List<JobMatchResponse> relevant = aiPool.stream()
                .filter(m -> m.getMatchScore() > 0)
                .sorted(Comparator.comparingInt(JobMatchResponse::getMatchScore).reversed())
                .collect(Collectors.toList());
        return relevant;
    }

    // Mots trop génériques pour être discriminants dans un intitulé d'offre.
    private static final java.util.Set<String> TITLE_STOPWORDS = java.util.Set.of(
            "de", "du", "des", "la", "le", "les", "un", "une", "en", "et", "à", "au",
            "mois", "ans", "stage", "mission", "temps", "partiel", "freelance", "cdi", "cdd",
            "junior", "senior", "confirmé", "sur", "site", "hybride");

    /**
     * Score de correspondance mots-clés entre un CV et une offre, combinant deux signaux :
     *  - le TITRE de l'offre (signal fort : un CV « DevOps Engineer » doit ressortir sur
     *    « Ingénieur DevOps », pas sur « Développeur Backend »),
     *  - les COMPÉTENCES requises trouvées dans le CV.
     * Le titre est pondéré à 60 % car il porte l'essentiel de l'intention métier.
     */
    private int computeKeywordScore(String cvTextLower, String title, String requiredSkills) {
        if (cvTextLower.isBlank()) {
            return 0;
        }

        // --- Signal titre ---
        double titleScore = 0.0;
        if (title != null && !title.isBlank()) {
            List<String> titleTokens = new ArrayList<>();
            for (String w : title.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
                // >= 2 pour conserver les acronymes métier significatifs (QA, BI...).
                if (w.length() >= 2 && !TITLE_STOPWORDS.contains(w)) titleTokens.add(w);
            }
            if (!titleTokens.isEmpty()) {
                long matched = titleTokens.stream().filter(cvTextLower::contains).count();
                titleScore = (matched * 100.0) / titleTokens.size();
            }
        }

        // --- Signal compétences ---
        double skillsScore = 0.0;
        if (requiredSkills != null && !requiredSkills.isBlank()) {
            List<String> skills = new ArrayList<>();
            for (String s : requiredSkills.split(",")) {
                String trimmed = s.trim().toLowerCase(Locale.ROOT);
                if (!trimmed.isEmpty()) skills.add(trimmed);
            }
            if (!skills.isEmpty()) {
                long matched = skills.stream().filter(cvTextLower::contains).count();
                skillsScore = (matched * 100.0) / skills.size();
            }
        }

        return (int) Math.round(0.6 * titleScore + 0.4 * skillsScore);
    }
}
