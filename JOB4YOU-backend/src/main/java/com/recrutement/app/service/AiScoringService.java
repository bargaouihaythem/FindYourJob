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
     * Bande d'incertitude autour du seuil de décision effectif du profil : un score qui tombe
     * là ne doit jamais déclencher un rejet automatique, qu'il vienne de Cohere, du mode dégradé
     * ou d'un score transmis par un appelant externe (PATCH /ai-score). Elle suit le seuil calibré
     * sur le Gold Set : un profil calibré à 85 a sa zone grise à 80-90, pas à 55-65.
     */
    public static final int GREY_ZONE_MARGIN = 5;

    /**
     * Barre absolue d'excellence : au-dessus, le dossier est proposé « Profil Gold » au RH.
     * 85 vient de la mesure sur le Gold Set : à ce niveau, aucun cas hors cible du corpus
     * n'est proposé (le pire abusif mesuré est à 81) et les profils concernés sont tous pertinents.
     */
    public static final int EXCELLENT_SCORE = 85;

    /**
     * Plafond appliqué quand le CV est très loin du minimum d'expérience exigé par l'offre
     * (2 ans et plus sous la borne, pour un poste demandant au moins 3 ans). 45 laisse le
     * dossier sous le seuil d'auto-rejet et hors zone grise : c'est le RH qui tranche.
     */
    public static final int SENIORITY_GATE_MAX_SCORE = 45;

    public static boolean isGreyZone(int score, int threshold) {
        return Math.abs(score - threshold) <= GREY_ZONE_MARGIN;
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
        /** Années lues dans le CV et minimum d'années exigé par l'offre (null = non chiffrable). */
        public Integer candidateExperienceYears;
        public Integer requiredExperienceMinYears;
        /** Seuil de décision du profil utilisé pour cette candidature, et proposition « Profil Gold ». */
        public int decisionThreshold;
        public boolean goldProposed;
    }

    public AiScoreResult computeScore(Candidate candidate, JobOffer jobOffer) {
        String candidateText = buildCandidateText(candidate);
        String jobTitle = jobOffer != null ? jobOffer.getTitle() : null;
        String requiredSkills = jobOffer != null ? jobOffer.getRequiredSkills() : null;
        String experienceLevel = jobOffer != null ? jobOffer.getExperienceLevel() : null;

        // 1. Analyse structurée des compétences et normalisation (Remarque 3)
        SkillNormalizationService.MatchingExplanation explanation =
                skillNormalizationService.analyzeMatching(candidateText, requiredSkills, experienceLevel);

        Integer candidateYears = explanation.getCandidateExperienceYears();
        Integer requiredMinYears = explanation.getRequiredExperienceMinYears();
        // Quand le CV et l'offre sont tous deux chiffrés, l'écart de séniorité est un fait,
        // pas une impression du modèle : le calcul déterministe fait foi.
        boolean seniorityMeasurable = candidateYears != null && requiredMinYears != null;
        int deterministicSeniority = computeSeniorityScore(candidateText, experienceLevel, candidateYears, requiredMinYears);

        int technical;
        int communication;
        int seniorityMatch;
        String source;

        try {
            CohereClient.ScoreBreakdown breakdown = cohereClient.scoreCandidate(candidateText, jobTitle, requiredSkills, experienceLevel);
            technical = breakdown.technical;
            communication = breakdown.communication;
            seniorityMatch = seniorityMeasurable ? deterministicSeniority : breakdown.seniority;
            source = "COHERE";
        } catch (Exception e) {
            log.info("[AiScoringService] Mode simulé activé (Cohere indisponible) : {}", e.getMessage());
            // Calcul technique basé sur la normalisation fine des compétences
            technical = Math.max(30, (int) Math.round(explanation.getTechnicalMatchRate() * 100));
            communication = computeCommunicationScore(candidate, candidateText);
            seniorityMatch = deterministicSeniority;
            source = "SIMULATED";
        }

        ScoringWeightProfileService.ScoringWeights weights = scoringWeightProfileService.resolveWeights(
                jobOffer != null ? jobOffer.getJobFamily() : null,
                jobOffer != null ? jobOffer.getSeniorityLevel() : null);
        int decisionThreshold = scoringWeightProfileService.resolveDecisionThreshold(jobOffer);

        int finalScore = (int) Math.round(
                technical * weights.technical
                        + communication * weights.communication
                        + seniorityMatch * weights.seniority
        );
        finalScore = Math.max(0, Math.min(100, finalScore));

        // 2. Garde de séniorité : postuler deux ans et plus sous le minimum exigé par un poste
        // expérimenté n'est pas une candidature « à transmettre », quoi qu'en disent les compétences.
        // Le score est plafonné sous le seuil d'auto-rejet pour que l'arbitrage revienne au RH.
        int seniorityGap = seniorityMeasurable ? requiredMinYears - candidateYears : 0;
        boolean severeSeniorityGap = seniorityMeasurable && seniorityGap >= 2 && requiredMinYears >= 3;
        // Le plafond doit rester sous la zone grise quelle que soit la valeur calibrée du seuil.
        int seniorityCeiling = Math.min(SENIORITY_GATE_MAX_SCORE, decisionThreshold - GREY_ZONE_MARGIN - 1);
        if (severeSeniorityGap) {
            finalScore = Math.min(finalScore, seniorityCeiling);
        }

        AiScoreResult result = new AiScoreResult();
        result.technicalScore = technical;
        result.communicationScore = communication;
        result.seniorityMatchScore = seniorityMatch;
        result.finalScore = finalScore;
        result.source = source;
        result.matchedSkills = String.join(", ", explanation.getMatchedSkills());
        result.missingSkills = String.join(", ", explanation.getMissingSkills());
        result.detailedJustification = explanation.getDetailedJustification();
        result.candidateExperienceYears = candidateYears;
        result.requiredExperienceMinYears = requiredMinYears;

        // 3. Détection d'erreurs et cas nécessitant une intervention humaine (Remarque 2)
        boolean hasParsingIssue = candidate.getCv() != null
                && (candidate.getCv().getExtractedText() == null || candidate.getCv().getExtractedText().trim().length() < 50);
        boolean isGrayZone = isGreyZone(finalScore, decisionThreshold);
        boolean isDegradedMode = "SIMULATED".equals(source);

        if (hasParsingIssue) {
            result.needsHumanReview = true;
            result.humanReviewReason = "Échec d'extraction du texte du CV (scan, image ou fichier corrompu) : vérification manuelle obligatoire du document.";
        } else if (severeSeniorityGap) {
            result.needsHumanReview = true;
            result.humanReviewReason = String.format(Locale.FRANCE,
                    "Écart de séniorité : %d an(s) d'expérience détecté(s) dans le CV pour un minimum de %d an(s) exigé par l'offre (%s). "
                            + "Score plafonné à %d/100 sous le seuil d'auto-rejet (%d) : le dossier reste à arbitrer par le RH et n'est pas transmis à un manager.",
                    candidateYears, requiredMinYears, experienceLevel, seniorityCeiling, decisionThreshold);
        } else if (isGrayZone) {
            result.needsHumanReview = true;
            result.humanReviewReason = String.format(Locale.FRANCE,
                    "Score en zone grise incertaine (%d/100, seuil de décision = %d) : arbitrage humain recommandé.",
                    finalScore, decisionThreshold);
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
        String experienceResume = seniorityMeasurable
                ? String.format(Locale.FRANCE, " · Expérience : %d an(s) côté candidat pour un minimum de %d an(s) côté offre",
                        candidateYears, requiredMinYears)
                : "";
        result.summary = String.format(Locale.FRANCE,
                "Technique : %d/100 · Communication : %d/100 · Séniorité : %d/100 (source : %s)%s%s",
                technical, communication, seniorityMatch, source, experienceResume, skillsResume);

        result.decisionThreshold = decisionThreshold;
        // « Bon » se lit par rapport au seuil calibré du profil ; la barre d'excellence reste
        // absolue (85) mais ne peut jamais descendre sous le seuil : un profil exigeant n'a pas
        // d'excellence en dessous de ce qu'il retient.
        int excellentBar = Math.max(EXCELLENT_SCORE, decisionThreshold);
        result.recommendation = finalScore >= excellentBar ? "EXCELLENT_MATCH"
                : finalScore >= decisionThreshold ? "GOOD_MATCH"
                : "WEAK_MATCH";
        // Le RH seul confirme l'étiquette ; la machine ne fait qu'une proposition, et jamais
        // sur un dossier qu'elle signale elle-même comme incertain ou dégradé.
        result.goldProposed = finalScore >= excellentBar
                && !result.needsHumanReview
                && "COHERE".equals(source);

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
     * Adéquation séniorité. Quand l'offre chiffre un minimum d'années et que le CV en chiffre
     * aussi, l'écart est calculé directement — les formulations libres (« 5-8 ans », « 5+ ans »,
     * « à partir de 3 ans ») étaient auparavant ignorées et renvoyaient un 70 neutre, ce qui
     * laissait un profil junior de 1 an remonter sur un poste Tech Lead.
     *
     * Les années du candidat sont lues par SkillNormalizationService.extractExperienceYears, qui
     * distingue « 5 ans d'expérience » des versions d'outils (« Java 17 », « Angular 16 ») et
     * accepte l'apostrophe typographique des CV Word et PDF.
     */
    private int computeSeniorityScore(String candidateText, String requiredLevel,
                                      Integer candidateYears, Integer requiredMinYears) {
        if (requiredLevel == null || requiredLevel.isBlank()) {
            return 70;
        }

        if (candidateYears != null && requiredMinYears != null) {
            if (requiredMinYears == 0) {
                // Poste junior / stage : l'expérience ne peut pas disqualifier, la surqualification
                // seulement (risque d'adéquation salariale et de départ rapide).
                return candidateYears <= 2 ? 90 : 70;
            }
            int gap = requiredMinYears - candidateYears;
            if (gap <= 0) return candidateYears > requiredMinYears * 2 ? 80 : 90;
            if (gap == 1) return 65;
            if (gap == 2) return 40;
            return 20;
        }
        if (candidateYears == null && requiredMinYears != null && requiredMinYears > 0) {
            // exigence chiffrée, CV muet sur les années : rien à affirmer
            return 55;
        }

        String text = candidateText == null ? "" : candidateText.toLowerCase(Locale.ROOT);
        String level = requiredLevel.toLowerCase(Locale.ROOT);

        boolean seniorEvidence = (candidateYears != null && candidateYears >= 5)
                || text.contains("senior") || text.contains("lead")
                || text.contains("manager") || text.contains("architect");
        boolean juniorEvidence = (candidateYears != null && candidateYears <= 2)
                || text.contains("junior") || text.contains("stage")
                || text.contains("débutant") || text.contains("étudiant");

        if (level.contains("senior")) return seniorEvidence ? 85 : juniorEvidence ? 40 : 65;
        if (level.contains("junior") || level.contains("entry")) return juniorEvidence ? 90 : seniorEvidence ? 70 : 75;
        if (level.contains("mid") || level.contains("interm")) return seniorEvidence ? 80 : juniorEvidence ? 60 : 75;
        return 70;
    }
}
