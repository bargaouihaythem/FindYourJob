package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Service de scoring IA par critères pour les candidatures.
 *
 * Le score final combine 3 critères pondérés :
 *   - technique     : adéquation compétences candidat / compétences requises
 *   - communication : qualité / professionnalisme du texte de candidature
 *   - séniorité     : adéquation entre le niveau demandé par l'offre
 *                     (JUNIOR/MID/SENIOR) et le niveau perçu du candidat
 *
 * Moteur IA : Cohere (Chat API) — accessible depuis le réseau Sopra Steria,
 * contrairement à l'API d'inférence HuggingFace qui y est bloquée (DNS).
 * Si Cohere n'est pas configuré ou indisponible, un mode dégradé (simulé)
 * est utilisé pour ne jamais bloquer le flux de candidature.
 */
@Service
public class AiScoringService {

    private static final Logger log = LoggerFactory.getLogger(AiScoringService.class);

    private final CohereClient cohereClient;
    private final ScoringWeightProfileService scoringWeightProfileService;

    public AiScoringService(CohereClient cohereClient, ScoringWeightProfileService scoringWeightProfileService) {
        this.cohereClient = cohereClient;
        this.scoringWeightProfileService = scoringWeightProfileService;
    }

    public static class AiScoreResult {
        public int technicalScore;
        public int communicationScore;
        public int seniorityMatchScore;
        public int finalScore;
        public String source; // COHERE | SIMULATED
        public String summary;
        public String recommendation;
    }

    public AiScoreResult computeScore(Candidate candidate, JobOffer jobOffer) {
        String candidateText = buildCandidateText(candidate);
        String jobTitle = jobOffer != null ? jobOffer.getTitle() : null;
        String requiredSkills = jobOffer != null ? jobOffer.getRequiredSkills() : null;
        String experienceLevel = jobOffer != null ? jobOffer.getExperienceLevel() : null;

        int technical;
        int communication;
        int seniorityMatch;
        String source;

        try {
            CohereClient.ScoreBreakdown breakdown = cohereClient.scoreCandidate(candidateText, jobTitle, requiredSkills, experienceLevel);
            technical = breakdown.technical;
            communication = breakdown.communication;
            seniorityMatch = breakdown.seniority;
            source = "COHERE";
        } catch (Exception e) {
            log.info("[AiScoringService] Mode simulé activé (Cohere indisponible) : {}", e.getMessage());
            technical = computeTechnicalScore(candidateText, requiredSkills);
            communication = simulateScore();
            seniorityMatch = simulateScore();
            source = "SIMULATED";
        }

        ScoringWeightProfileService.ScoringWeights weights = scoringWeightProfileService.resolveWeights(
                jobOffer != null ? jobOffer.getJobFamily() : null,
                jobOffer != null ? jobOffer.getSeniorityLevel() : null);

        int finalScore = (int) Math.round(
                technical * weights.technical
                        + communication * weights.communication
                        + seniorityMatch * weights.seniority
        );
        finalScore = Math.max(0, Math.min(100, finalScore));

        AiScoreResult result = new AiScoreResult();
        result.technicalScore = technical;
        result.communicationScore = communication;
        result.seniorityMatchScore = seniorityMatch;
        result.finalScore = finalScore;
        result.source = source;
        result.summary = String.format(Locale.FRANCE,
                "Technique : %d/100 · Communication : %d/100 · Adéquation séniorité : %d/100 (source : %s)",
                technical, communication, seniorityMatch, source);
        result.recommendation = finalScore >= 85 ? "EXCELLENT_MATCH"
                : finalScore >= 60 ? "GOOD_MATCH"
                : "WEAK_MATCH";

        return result;
    }

    /**
     * Construit le texte du candidat pour le scoring IA : le texte extrait du
     * CV (PDF/DOCX) est prioritaire car bien plus riche que la lettre de
     * motivation ; celle-ci sert de complément, puis de repli si le CV n'a
     * pas pu être extrait (scan image, format non supporté, etc.).
     */
    private String buildCandidateText(Candidate candidate) {
        StringBuilder sb = new StringBuilder();
        String cvText = candidate.getCv() != null ? candidate.getCv().getExtractedText() : null;
        if (cvText != null && !cvText.isBlank()) sb.append(cvText).append(". ");
        if (candidate.getCoverLetter() != null) sb.append(candidate.getCoverLetter()).append(". ");
        if (sb.length() == 0) sb.append("Candidat sans CV exploitable ni lettre de motivation fournie.");
        return sb.toString();
    }

    /**
     * Score technique déterministe : pourcentage de compétences requises
     * (offre) retrouvées dans le texte du candidat (mots-clés, insensible à la casse).
     */
    private int computeTechnicalScore(String candidateText, String requiredSkills) {
        if (requiredSkills == null || requiredSkills.isBlank()) {
            return 70; // valeur neutre si l'offre ne précise pas de compétences
        }

        String textLower = candidateText.toLowerCase(Locale.ROOT);
        List<String> skills = new ArrayList<>();
        for (String s : requiredSkills.split(",")) {
            String trimmed = s.trim();
            if (!trimmed.isEmpty()) skills.add(trimmed.toLowerCase(Locale.ROOT));
        }
        if (skills.isEmpty()) return 70;

        long matched = skills.stream().filter(textLower::contains).count();
        int score = (int) Math.round((matched * 100.0) / skills.size());
        // Score plancher pour éviter les 0 secs qui découragent (le mot-clé exact peut manquer sans que le profil soit mauvais)
        return Math.max(30, score);
    }

    private int simulateScore() {
        return ThreadLocalRandom.current().nextInt(55, 91); // 55-90
    }
}
