package com.recrutement.app.service;

import com.recrutement.app.entity.GoldSetCase;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import com.recrutement.app.repository.GoldSetCaseRepository;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.ScoringWeightProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Le Gold Set vivant : les CVs de référence dont la bonne décision est connue vivent en base,
 * sont rejoués dans le processus de décision (même code, même pondération, même IA que pour
 * une vraie candidature, sans jamais rien enregistrer côté candidat), et en tirent le seuil
 * de décision de chaque profil famille × séniorité.
 *
 * C'est la seule porte d'écriture du seuil calibré : aucune valeur n'est enregistrée si la
 * qualité mesurée sur le noyau de référence ne tient pas.
 */
@Service
public class GoldSetCalibrationService {

    private static final Logger log = LoggerFactory.getLogger(GoldSetCalibrationService.class);

    /** Un seuil n'est proposé que si le noyau de référence contient assez de cas pour peser. */
    public static final int MIN_REFERENCE_CASES_PER_PROFILE = 4;
    public static final double MIN_F1_TO_APPLY = 0.90;
    private static final int THRESHOLD_MIN = 40;
    private static final int THRESHOLD_MAX = 95;
    private static final int GOLD_SCORE = AiScoringService.EXCELLENT_SCORE;

    private final GoldSetCaseRepository goldSetCaseRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ScoringWeightProfileRepository scoringWeightProfileRepository;
    private final ScoringWeightProfileService scoringWeightProfileService;
    private final AiScoringService aiScoringService;
    private final CvTextExtractionService cvTextExtractionService;
    private final AuditLogService auditLogService;

    public GoldSetCalibrationService(GoldSetCaseRepository goldSetCaseRepository,
                                     JobOfferRepository jobOfferRepository,
                                     ScoringWeightProfileRepository scoringWeightProfileRepository,
                                     ScoringWeightProfileService scoringWeightProfileService,
                                     AiScoringService aiScoringService,
                                     CvTextExtractionService cvTextExtractionService,
                                     AuditLogService auditLogService) {
        this.goldSetCaseRepository = goldSetCaseRepository;
        this.jobOfferRepository = jobOfferRepository;
        this.scoringWeightProfileRepository = scoringWeightProfileRepository;
        this.scoringWeightProfileService = scoringWeightProfileService;
        this.aiScoringService = aiScoringService;
        this.cvTextExtractionService = cvTextExtractionService;
        this.auditLogService = auditLogService;
    }

    // ------------------------------------------------------------------ dépôt

    /**
     * Enregistre (ou remplace) un cas de référence. Le texte est extrait par le même service
     * que pour une vraie candidature : le rejeu portera exactement la matière vue par l'IA.
     */
    @Transactional
    public GoldSetCase upsertCase(String caseRef, String candidateName, Long jobOfferId,
                                  GoldSetCase.Relevance groundTruth, boolean borderline,
                                  GoldSetCase.Origin origin, byte[] fileContent,
                                  String contentType, String filename) {
        if (caseRef == null || caseRef.isBlank()) {
            throw new IllegalArgumentException("La référence du cas est obligatoire");
        }
        JobOffer jobOffer = jobOfferRepository.findById(jobOfferId)
                .orElseThrow(() -> new IllegalArgumentException("Offre de référence introuvable : " + jobOfferId));
        if (jobOffer.getJobFamily() == null || jobOffer.getSeniorityLevel() == null) {
            throw new IllegalArgumentException(
                    "L'offre " + jobOfferId + " n'est ni famillée ni nivelée : impossible d'en faire un cas de référence");
        }

        String text = cvTextExtractionService.extractText(
                new java.io.ByteArrayInputStream(fileContent), contentType, filename);
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Aucun texte exploitable extrait de ce CV de référence");
        }

        GoldSetCase testCase = goldSetCaseRepository.findByCaseRef(caseRef).orElseGet(GoldSetCase::new);
        testCase.setCaseRef(caseRef);
        testCase.setCandidateName(candidateName);
        testCase.setJobOffer(jobOffer);
        testCase.setGroundTruth(groundTruth);
        testCase.setBorderline(borderline);
        testCase.setOrigin(origin == null ? GoldSetCase.Origin.EXTENSION_RH : origin);
        testCase.setOriginalFilename(filename);
        testCase.setExtractedText(text);

        GoldSetCase saved = goldSetCaseRepository.save(testCase);
        auditLogService.log("GOLD_SET", saved.getId(), "CASE_UPSERTED",
                null, saved.getCaseRef() + " → offre " + jobOfferId + " (" + groundTruth + ")");
        return saved;
    }

    @Transactional(readOnly = true)
    public List<GoldSetCase> listCases() {
        return goldSetCaseRepository.findAllWithOffer();
    }

    // ------------------------------------------------------------- calibration

    /**
     * Rejoue tout le corpus dans le processus et mesure la décision automatique.
     *
     * @param replay true = recalculer les scores (appel IA, ~20 secondes pour 20 cas) ;
     *               false = réutiliser le dernier score enregistré, pour relire la mesure sans coût.
     */
    @Transactional
    public CalibrationReport calibrate(boolean replay) {
        List<GoldSetCase> cases = goldSetCaseRepository.findAllWithOffer();
        if (cases.isEmpty()) {
            throw new IllegalStateException("Aucun cas dans le Gold Set : déposer d'abord les CVs de référence");
        }

        if (replay) {
            for (GoldSetCase testCase : cases) {
                AiScoringService.AiScoreResult result = aiScoringService.computeScore(
                        ephemeralCandidate(testCase), testCase.getJobOffer());
                testCase.setLastScore(result.finalScore);
                testCase.setLastScoreSource(result.source);
                testCase.setLastEvaluatedAt(LocalDateTime.now());
                goldSetCaseRepository.save(testCase);
            }
        }

        List<GoldSetCase> scored = cases.stream().filter(c -> c.getLastScore() != null).toList();
        if (scored.isEmpty()) {
            throw new IllegalStateException("Aucun score enregistré : lancer la recalibration");
        }

        CalibrationReport report = new CalibrationReport();
        report.evaluatedAt = LocalDateTime.now();
        report.source = scored.stream().anyMatch(c -> "COHERE".equals(c.getLastScoreSource())) ? "COHERE" : "SIMULATED";
        report.global = measure("GLOBAL", scored);
        report.byProfile = new ArrayList<>();
        for (Map.Entry<ProfileKey, List<GoldSetCase>> entry : groupByProfile(scored).entrySet()) {
            report.byProfile.add(measure(entry.getKey(), entry.getValue()));
        }
        report.goldTier = goldTier(scored);
        log.info("[GoldSet] calibration {} cas, F1 global {}", scored.size(), report.global.f1);
        return report;
    }

    private Map<ProfileKey, List<GoldSetCase>> groupByProfile(List<GoldSetCase> cases) {
        Map<ProfileKey, List<GoldSetCase>> grouped = new TreeMap<>();
        for (GoldSetCase testCase : cases) {
            grouped.computeIfAbsent(new ProfileKey(testCase.getJobOffer().getJobFamily(),
                    testCase.getJobOffer().getSeniorityLevel()), k -> new ArrayList<>()).add(testCase);
        }
        return grouped;
    }

    /**
     * Applique un seuil à un profil. Refuse si le noyau de référence est trop mince ou si la
     * qualité mesurée ne tient pas : le seuil de production ne bouge que sur preuve.
     */
    @Transactional
    public ProfileReport applyThreshold(JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel seniorityLevel,
                                        Integer threshold, String actingUser) {
        if (threshold == null) {
            scoringWeightProfileService.saveDecisionThreshold(jobFamily, seniorityLevel, null, null, actingUser);
            auditLogService.log("SCORING_PROFILE", 0L, "THRESHOLD_RESET",
                    jobFamily + "/" + seniorityLevel, "seuil par défaut "
                            + scoringWeightProfileService.getDefaultDecisionThreshold());
            return null;
        }
        if (threshold < THRESHOLD_MIN || threshold > THRESHOLD_MAX) {
            throw new IllegalArgumentException("Le seuil doit être compris entre " + THRESHOLD_MIN + " et " + THRESHOLD_MAX);
        }

        List<GoldSetCase> cases = goldSetCaseRepository.findAllWithOffer().stream()
                .filter(c -> c.getLastScore() != null
                        && c.getJobOffer().getJobFamily() == jobFamily
                        && c.getJobOffer().getSeniorityLevel() == seniorityLevel)
                .toList();

        long referenceCount = cases.stream().filter(c -> c.getOrigin() == GoldSetCase.Origin.REFERENCE).count();
        if (referenceCount < MIN_REFERENCE_CASES_PER_PROFILE) {
            throw new IllegalArgumentException(String.format(
                    "Profil %s / %s non calibrable : %d cas de référence mesurés sur %d nécessaires. "
                            + "Le seuil reste à la valeur par défaut (%d).",
                    jobFamily, seniorityLevel, referenceCount, MIN_REFERENCE_CASES_PER_PROFILE,
                    scoringWeightProfileService.getDefaultDecisionThreshold()));
        }

        ProfileReport measured = measure(new ProfileKey(jobFamily, seniorityLevel), cases);
        // La qualité s'apprécie AU SEUIL DEMANDÉ, pas au seuil actuellement en vigueur :
        // sinon on refuserait la valeur même que la mesure recommande.
        double f1AtRequested = round4(confusion(cases, threshold).f1());
        if (f1AtRequested < MIN_F1_TO_APPLY) {
            throw new IllegalArgumentException(String.format(
                    "Seuil %d refusé sur %s / %s : F1 mesuré = %.1f %% sur le noyau de référence, "
                            + "minimum exigé %.0f %%. Le seuil recommandé par la mesure est %s.",
                    threshold, jobFamily, seniorityLevel, f1AtRequested * 100, MIN_F1_TO_APPLY * 100,
                    measured.recommendedThreshold == null ? "—" : measured.recommendedThreshold.toString()));
        }

        ScoringWeightProfile saved = scoringWeightProfileService.saveDecisionThreshold(
                jobFamily, seniorityLevel, threshold, f1AtRequested, actingUser);
        auditLogService.log("SCORING_PROFILE", saved.getId(), "THRESHOLD_CALIBRATED",
                jobFamily + "/" + seniorityLevel,
                "seuil " + threshold + " (F1 " + formatRate(f1AtRequested) + " sur "
                        + measured.caseCount + " cas de référence)");
        return measure(new ProfileKey(jobFamily, seniorityLevel), cases);
    }

    // ---------------------------------------------------------------- mesures

    private ProfileReport measure(Object label, List<GoldSetCase> cases) {
        ProfileReport report = new ProfileReport();
        if (label instanceof ProfileKey key) {
            report.jobFamily = key.jobFamily;
            report.seniorityLevel = key.seniorityLevel;
        } else {
            report.jobFamily = null;
            report.seniorityLevel = null;
        }
        report.caseCount = cases.size();
        report.referenceCount = (int) cases.stream().filter(c -> c.getOrigin() == GoldSetCase.Origin.REFERENCE).count();
        report.pertinentCount = (int) cases.stream().filter(GoldSetCase::expectedRetain).count();
        report.borderlineCount = (int) cases.stream().filter(GoldSetCase::isBorderline).count();
        report.scores = cases.stream().map(GoldSetCase::getLastScore).sorted().toList();

        Integer defaultThreshold = scoringWeightProfileService.getDefaultDecisionThreshold();
        Integer applied = report.jobFamily == null ? null : appliedThreshold(report.jobFamily, report.seniorityLevel);
        report.appliedThreshold = applied != null ? applied : defaultThreshold;
        report.appliedIsCalibrated = applied != null;

        // Balayage : la décision est un simple comparateur, donc tout l'axe des seuils se lit
        // dans une seule passe de scores — aucun surcoût d'appel IA par seuil testé.
        double bestF1 = -1;
        int bestThreshold = -1;
        int bestMargin = -1;
        for (int t = THRESHOLD_MIN; t <= THRESHOLD_MAX; t++) {
            Confusion c = confusion(cases, t);
            double f1 = c.f1();
            int margin = margin(cases, t);
            if (f1 > bestF1 + 1e-9 || (Math.abs(f1 - bestF1) < 1e-9 && margin > bestMargin)) {
                bestF1 = f1;
                bestThreshold = t;
                bestMargin = margin;
            }
            if (t == report.appliedThreshold) {
                report.appliedConfusion = c;
            }
        }
        report.recommendedThreshold = bestThreshold;
        report.recommendedMargin = bestMargin;
        report.f1 = round4(bestF1);
        report.precision = round4(confusion(cases, bestThreshold).precision());
        report.recall = round4(confusion(cases, bestThreshold).recall());
        report.f1AtAppliedThreshold = report.appliedConfusion == null ? null : round4(report.appliedConfusion.f1());
        report.cases = cases.stream().map(this::describe).toList();
        return report;
    }

    private Integer appliedThreshold(JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel level) {
        return scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(jobFamily, level)
                .map(ScoringWeightProfile::getDecisionThreshold)
                .orElse(null);
    }

    private Confusion confusion(List<GoldSetCase> cases, int threshold) {
        Confusion c = new Confusion();
        for (GoldSetCase testCase : cases) {
            boolean predicted = testCase.getLastScore() >= threshold;
            boolean expected = testCase.expectedRetain();
            if (predicted && expected) c.truePositive++;
            else if (predicted) c.falsePositive++;
            else if (expected) c.falseNegative++;
            else c.trueNegative++;
        }
        return c;
    }

    /** Distance au score le plus proche : à F1 égal, on retient le seuil le moins fragile. */
    private int margin(List<GoldSetCase> cases, int threshold) {
        int min = Integer.MAX_VALUE;
        for (GoldSetCase testCase : cases) {
            min = Math.min(min, Math.abs(testCase.getLastScore() - threshold));
        }
        return min == Integer.MAX_VALUE ? 0 : min;
    }

    private Map<String, Object> describe(GoldSetCase testCase) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("caseRef", testCase.getCaseRef());
        row.put("candidateName", testCase.getCandidateName());
        row.put("jobOfferId", testCase.getJobOffer().getId());
        row.put("groundTruth", testCase.getGroundTruth().name());
        row.put("expected", testCase.expectedRetain());
        row.put("borderline", testCase.isBorderline());
        row.put("origin", testCase.getOrigin().name());
        row.put("score", testCase.getLastScore());
        row.put("source", testCase.getLastScoreSource());
        return row;
    }

    /** Étoile « Profil Gold » : proposition machine sur le corpus, pour mémoire et pour le rapport. */
    private Map<String, Object> goldTier(List<GoldSetCase> cases) {
        Map<String, Object> tier = new LinkedHashMap<>();
        for (int cut : new int[]{80, 85, 90}) {
            List<GoldSetCase> proposed = cases.stream()
                    .filter(c -> c.getLastScore() >= cut).toList();
            long abusive = proposed.stream().filter(c -> !c.expectedRetain()).count();
            tier.put("seuil_" + cut, Map.of(
                    "proposes", proposed.size(),
                    "abusifs", abusive,
                    "references", proposed.stream()
                            .map(GoldSetCase::getCaseRef).toList()));
        }
        tier.put("barre_appliquee", GOLD_SCORE);
        return tier;
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private static String formatRate(Double v) {
        return v == null ? "—" : String.format(java.util.Locale.FRANCE, "%.1f", v * 100) + " %";
    }

    /**
     * Dossier jetable : jamais persisté, jamais visible côté candidat. Le texte extrait du cas
     * de référence entre exactement par la même porte que celui d'une vraie candidature.
     */
    private com.recrutement.app.entity.Candidate ephemeralCandidate(GoldSetCase testCase) {
        com.recrutement.app.entity.Candidate holder = new com.recrutement.app.entity.Candidate();
        holder.setFirstName("GoldSet");
        holder.setLastName(testCase.getCaseRef());
        holder.setJobOffer(testCase.getJobOffer());

        com.recrutement.app.entity.CV holderCv = new com.recrutement.app.entity.CV();
        holderCv.setOriginalFilename(testCase.getOriginalFilename());
        holderCv.setExtractedText(testCase.getExtractedText());
        holder.setCv(holderCv);
        return holder;
    }

    // ------------------------------------------------------------------ types

    public static class Confusion {
        public int truePositive;
        public int falsePositive;
        public int falseNegative;
        public int trueNegative;

        public double precision() {
            int predicted = truePositive + falsePositive;
            return predicted == 0 ? 0d : (double) truePositive / predicted;
        }

        public double recall() {
            int expected = truePositive + falseNegative;
            return expected == 0 ? 0d : (double) truePositive / expected;
        }

        public double f1() {
            double p = precision(), r = recall();
            return (p + r) == 0 ? 0d : 2 * p * r / (p + r);
        }
    }

    public static class ProfileReport {
        public JobOffer.JobFamily jobFamily;
        public JobOffer.SeniorityLevel seniorityLevel;
        public int caseCount;
        public int referenceCount;
        public int pertinentCount;
        public int borderlineCount;
        public List<Integer> scores;
        public Integer appliedThreshold;
        public boolean appliedIsCalibrated;
        public Integer recommendedThreshold;
        public Integer recommendedMargin;
        public Double f1;
        public Double precision;
        public Double recall;
        public Double f1AtAppliedThreshold;
        public Confusion appliedConfusion;
        public List<Map<String, Object>> cases;
    }

    public static class CalibrationReport {
        public LocalDateTime evaluatedAt;
        public String source;
        public ProfileReport global;
        public List<ProfileReport> byProfile;
        public Map<String, Object> goldTier;
    }

    /** Clé de regroupement triable (famille puis niveau) pour un rapport stable. */
    private static class ProfileKey implements Comparable<ProfileKey> {
        final JobOffer.JobFamily jobFamily;
        final JobOffer.SeniorityLevel seniorityLevel;

        ProfileKey(JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel seniorityLevel) {
            this.jobFamily = jobFamily;
            this.seniorityLevel = seniorityLevel;
        }

        @Override
        public int compareTo(ProfileKey other) {
            int byFamily = this.jobFamily.compareTo(other.jobFamily);
            return byFamily != 0 ? byFamily : this.seniorityLevel.compareTo(other.seniorityLevel);
        }
    }
}
