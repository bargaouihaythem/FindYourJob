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

    /**
     * Bande d'incertitude autour du seuil de décision : un score qui tombe là ne doit
     * jamais déclencher un rejet automatique, qu'il vienne de Cohere, du mode dégradé ou
     * d'un score transmis par un appelant externe (PATCH /ai-score).
     */
    public static final int GREY_ZONE_LOW = 55;
    public static final int GREY_ZONE_HIGH = 65;

    public static boolean isGreyZone(int score) {
        return score >= GREY_ZONE_LOW && score <= GREY_ZONE_HIGH;
    }

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
            communication = computeCommunicationScore(candidate, candidateText);
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
        boolean isGrayZone = isGreyZone(finalScore);
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

    /**
     * Score de communication en mode dégradé uniquement.
     *
     * Sans le modèle, la qualité rédactionnelle ne peut pas être jugée sur le sens du texte :
     * on note seulement sa tenue formelle, et l'amplitude est volontairement encadrée autour
     * de la valeur neutre (±10 × poids 0,2 = ±2 au score final), pour qu'un CV simplement plus
     * long ne gagne pas des points de communication. Le mode dégradé déclenche de toute façon
     * une validation humaine.
     */
    private int computeCommunicationScore(Candidate candidate, String candidateText) {
        if (candidateText == null || candidateText.isBlank()) {
            return 50;
        }
        int score = 50;

        boolean hasCoverLetter = candidate.getCoverLetter() != null && !candidate.getCoverLetter().isBlank();
        if (hasCoverLetter) score += 8;

        long structuredLines = candidateText.lines().filter(line -> line.trim().length() > 3).count();
        if (structuredLines >= 4) score += 6;
        if (structuredLines <= 1 && candidateText.length() > 300) score -= 7;

        return Math.max(40, Math.min(60, score));
    }

    /**
     * Adéquation séniorité en mode dégradé. Le nombre d'années est lu par
     * SkillNormalizationService.extractExperienceYears, qui distingue « 5 ans d'expérience »
     * des versions d'outils (« Java 17 », « Angular 16 ») et accepte l'apostrophe typographique
     * des CV Word et PDF — un test sur « ans d'expérience » en ASCII passerait à côté.
     */
    private int computeSeniorityScore(String candidateText, String requiredLevel) {
        if (requiredLevel == null || requiredLevel.isBlank()) {
            return 70;
        }
        String text = candidateText == null ? "" : candidateText.toLowerCase(Locale.ROOT);
        String level = requiredLevel.toLowerCase(Locale.ROOT);

        Integer years = skillNormalizationService.extractExperienceYears(text);
        boolean seniorEvidence = (years != null && years >= 5)
                || text.contains("senior") || text.contains("lead")
                || text.contains("manager") || text.contains("architect");
        boolean juniorEvidence = (years != null && years <= 2)
                || text.contains("junior") || text.contains("stage")
                || text.contains("débutant") || text.contains("étudiant");

        if (level.contains("senior")) return seniorEvidence ? 85 : juniorEvidence ? 40 : 65;
        if (level.contains("junior") || level.contains("entry")) return juniorEvidence ? 90 : seniorEvidence ? 70 : 75;
        if (level.contains("mid") || level.contains("interm")) return seniorEvidence ? 80 : juniorEvidence ? 60 : 75;
        return 70;
    }
}
