package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Service de scoring IA par critères pour les candidatures.
 *
 * Combine les 3 critères :
 *   - technique     : adéquation compétences normalisées candidat / compétences requises (Remarque 3)
 *   - communication : qualité / professionnalisme du texte de candidature
 *   - séniorité     : adéquation entre le niveau requis et le niveau détecté
 *
 * Intègre :
 *   - L'explicabilité XAI : compétences trouvées, manquantes, bonus, justification (Remarque 3)
 *   - La détection d'erreurs et des cas nécessitant une intervention humaine (Remarque 2)
 */
@Service
public class AiScoringService {

    private static final Logger log = LoggerFactory.getLogger(AiScoringService.class);

    private final CohereClient cohereClient;
    private final ScoringWeightProfileService scoringWeightProfileService;
    private final SkillNormalizationService skillNormalizationService;

    public AiScoringService(CohereClient cohereClient,
                            ScoringWeightProfileService scoringWeightProfileService,
                            SkillNormalizationService skillNormalizationService) {
        this.cohereClient = cohereClient;
        this.scoringWeightProfileService = scoringWeightProfileService;
        this.skillNormalizationService = skillNormalizationService;
    }

    public static class AiScoreResult {
        public int technicalScore;
        public int communicationScore;
        public int seniorityMatchScore;
        public int finalScore;
        public String source; // COHERE | SIMULATED
        public String summary;
        public String recommendation;
        public String matchedSkills;
        public String missingSkills;
        public boolean needsHumanReview;
        public String humanReviewReason;
        public String detailedJustification;
    }

    public AiScoreResult computeScore(Candidate candidate, JobOffer jobOffer) {
        String candidateText = buildCandidateText(candidate);
        String jobTitle = jobOffer != null ? jobOffer.getTitle() : null;
        String requiredSkills = jobOffer != null ? jobOffer.getRequiredSkills() : null;
        String experienceLevel = jobOffer != null ? jobOffer.getExperienceLevel() : null;

        // 1. Analyse structurée des compétences et normalisation (Remarque 3)
        SkillNormalizationService.MatchingExplanation explanation =
                skillNormalizationService.analyzeMatching(candidateText, requiredSkills, experienceLevel);

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
            // Calcul technique basé sur la normalisation fine des compétences
            technical = Math.max(30, (int) Math.round(explanation.getTechnicalMatchRate() * 100));
            communication = computeCommunicationScore(candidateText);
            seniorityMatch = computeSeniorityScore(candidateText, experienceLevel);
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
        result.matchedSkills = String.join(", ", explanation.getMatchedSkills());
        result.missingSkills = String.join(", ", explanation.getMissingSkills());
        result.detailedJustification = explanation.getDetailedJustification();

        // 2. Détection d'erreurs et cas nécessitant une intervention humaine (Remarque 2)
        boolean hasParsingIssue = candidate.getCv() != null
                && (candidate.getCv().getExtractedText() == null || candidate.getCv().getExtractedText().trim().length() < 50);
        boolean isGrayZone = finalScore >= 55 && finalScore <= 65;
        boolean isDegradedMode = "SIMULATED".equals(source);

        if (hasParsingIssue) {
            result.needsHumanReview = true;
            result.humanReviewReason = "Échec d'extraction du texte du CV (scan, image ou fichier corrompu) : vérification manuelle obligatoire du document.";
        } else if (isGrayZone) {
            result.needsHumanReview = true;
            result.humanReviewReason = String.format(Locale.FRANCE,
                    "Score en zone grise incertaine (%d/100, seuil critique = 60) : arbitrage humain recommandé.", finalScore);
        } else if (isDegradedMode) {
            result.needsHumanReview = true;
            result.humanReviewReason = "Mode de secours dégradé activé (API IA indisponible, délai dépassé ou réponse invalide) : score calculé localement, validation humaine requise.";
        } else {
            result.needsHumanReview = false;
            result.humanReviewReason = null;
        }

        // Synthèse enrichie avec explicabilité XAI
        String skillsResume = !explanation.getMatchedSkills().isEmpty()
                ? " · Compétences validées : " + String.join(", ", explanation.getMatchedSkills())
                : "";
        result.summary = String.format(Locale.FRANCE,
                "Technique : %d/100 · Communication : %d/100 · Séniorité : %d/100 (source : %s)%s",
                technical, communication, seniorityMatch, source, skillsResume);

        result.recommendation = finalScore >= 85 ? "EXCELLENT_MATCH"
                : finalScore >= 60 ? "GOOD_MATCH"
                : "WEAK_MATCH";

        return result;
    }

    private String buildCandidateText(Candidate candidate) {
        StringBuilder sb = new StringBuilder();
        String cvText = candidate.getCv() != null ? candidate.getCv().getExtractedText() : null;
        if (cvText != null && !cvText.isBlank()) sb.append(cvText).append(". ");
        if (candidate.getCoverLetter() != null) sb.append(candidate.getCoverLetter()).append(". ");
        if (sb.length() == 0) sb.append("Candidat sans CV exploitable ni lettre de motivation fournie.");
        return sb.toString();
    }

    private int computeCommunicationScore(String candidateText) {
        if (candidateText == null || candidateText.isBlank()) {
            return 50;
        }
        int score = 50;
        int length = candidateText.trim().length();
        if (length >= 80) score += 10;
        if (length >= 200) score += 10;
        if (candidateText.matches("(?s).*[^.!?]$")) score -= 5;
        if (candidateText.contains("\n")) score += 5;
        return Math.max(30, Math.min(90, score));
    }

    private int computeSeniorityScore(String candidateText, String requiredLevel) {
        if (requiredLevel == null || requiredLevel.isBlank()) {
            return 70;
        }
        String text = candidateText == null ? "" : candidateText.toLowerCase(Locale.ROOT);
        String level = requiredLevel.toLowerCase(Locale.ROOT);
        boolean seniorEvidence = text.contains("senior") || text.contains("lead")
                || text.contains("manager") || text.contains("architect")
                || text.contains("ans d'expérience") || text.contains("years of experience");
        boolean juniorEvidence = text.contains("junior") || text.contains("stage")
                || text.contains("débutant") || text.contains("étudiant");
        if (level.contains("senior")) return seniorEvidence ? 85 : juniorEvidence ? 40 : 65;
        if (level.contains("junior") || level.contains("entry")) return juniorEvidence ? 90 : seniorEvidence ? 70 : 75;
        if (level.contains("mid") || level.contains("interm")) return seniorEvidence ? 80 : juniorEvidence ? 60 : 75;
        return 70;
    }
}
