package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Barème d'expérience des offres : Junior 0-2 ans, Confirmé (MID) 2-4 ans, Senior 5-8 ans,
 * Expert 8+ ans. `seniorityLevel` et `experienceLevel` sont les deux faces d'une même norme ;
 * laissés libres, ils finissent par se contredire (« SENIOR » avec « 2-3 ans ») et le scoring
 * de séniorité perd son point d'appui.
 */
public final class ExperienceLevelNorms {

    public static final String JUNIOR_LABEL = "0-2 ans";
    public static final String MID_LABEL = "2-4 ans";
    public static final String SENIOR_LABEL = "5-8 ans";
    public static final String EXPERT_LABEL = "8+ ans";

    public static final int JUNIOR_MIN_YEARS = 0;
    public static final int MID_MIN_YEARS = 2;
    public static final int SENIOR_MIN_YEARS = 5;
    public static final int EXPERT_MIN_YEARS = 8;

    private static final Pattern RANGE = Pattern.compile("(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})");
    private static final Pattern PLUS = Pattern.compile("(\\d{1,2})\\s*\\+");
    private static final Pattern FROM_NOW_ON = Pattern.compile("(?:a partir de|minimum|min)[^0-9]*(\\d{1,2})");
    private static final Pattern PLAIN_YEARS = Pattern.compile("(\\d{1,2})\\s*(?:ans|annees|years)");

    private ExperienceLevelNorms() {
    }

    public static Integer minYearsFor(JobOffer.SeniorityLevel seniority) {
        if (seniority == null) {
            return null;
        }
        switch (seniority) {
            case JUNIOR: return JUNIOR_MIN_YEARS;
            case MID: return MID_MIN_YEARS;
            case SENIOR: return SENIOR_MIN_YEARS;
            default: return null;
        }
    }

    public static String labelFor(JobOffer.SeniorityLevel seniority) {
        if (seniority == null) {
            return null;
        }
        switch (seniority) {
            case JUNIOR: return JUNIOR_LABEL;
            case MID: return MID_LABEL;
            case SENIOR: return SENIOR_LABEL;
            default: return null;
        }
    }

    /** Le libellé canonical du barème pour un minimum d'années exigé. */
    public static String labelForMinYears(int minYears) {
        if (minYears >= EXPERT_MIN_YEARS) return EXPERT_LABEL;
        if (minYears >= SENIOR_MIN_YEARS) return SENIOR_LABEL;
        if (minYears >= MID_MIN_YEARS) return MID_LABEL;
        return JUNIOR_LABEL;
    }

    public static JobOffer.SeniorityLevel seniorityForMinYears(int minYears) {
        if (minYears >= SENIOR_MIN_YEARS) return JobOffer.SeniorityLevel.SENIOR;
        if (minYears >= MID_MIN_YEARS) return JobOffer.SeniorityLevel.MID;
        return JobOffer.SeniorityLevel.JUNIOR;
    }

    /**
     * Minimum d'années lu dans un libellé d'offre, libre ou normalisé.
     * Renvoie null quand aucune exigence chiffrable n'est exprimée : l'appelant ne doit alors
     * pas pénaliser le candidat sur la séniorité.
     */
    public static Integer parseMinYears(String requiredLevel) {
        if (requiredLevel == null || requiredLevel.isBlank()) {
            return null;
        }
        String req = ascii(requiredLevel);

        Matcher range = RANGE.matcher(req);
        if (range.find()) {
            int min = Integer.parseInt(range.group(1));
            // « 0-2 ans » est un vrai palier Junior : le zéro n'est pas une valeur aberrante.
            return min >= 0 && min <= 35 ? min : null;
        }
        Integer fromDigits = firstMatch(PLUS, req);
        if (fromDigits == null) fromDigits = firstMatch(FROM_NOW_ON, req);
        if (fromDigits == null) fromDigits = firstMatch(PLAIN_YEARS, req);
        if (fromDigits != null) return fromDigits;

        if (req.contains("etudiant") || req.contains("stage") || req.contains("intern")
                || req.contains("junior") || req.contains("entry") || req.contains("debutant")
                || req.contains("fresher")) {
            return JUNIOR_MIN_YEARS;
        }
        if (req.contains("lead") || req.contains("architect") || req.contains("principal")
                || req.contains("expert")) {
            return EXPERT_MIN_YEARS;
        }
        if (req.contains("senior")) {
            return SENIOR_MIN_YEARS;
        }
        if (req.contains("confirme") || req.contains("confirmed") || req.contains("intermediaire")
                || req.contains("mid")) {
            return MID_MIN_YEARS;
        }
        return null;
    }

    /**
     * Fourchette affichée par l'offre, alignée sur le barème. La saisie chiffrée du RH fait foi
     * quand elle est lisible (« 10+ ans » reste 10+, ne redescend pas à « 5-8 ans ») ; sinon le
     * niveau de séniorité choisi impose son palier. Une saisie non chiffrable (« Étudiant »,
     * télétravail partiel, etc.) est conservée telle quelle.
     */
    public static String reconcileExperienceLabel(JobOffer.SeniorityLevel seniority, String experienceLevel) {
        Integer parsed = parseMinYears(experienceLevel);
        if (parsed != null) {
            return labelForMinYears(parsed);
        }
        String fromSeniority = labelFor(seniority);
        if (fromSeniority != null) {
            return fromSeniority;
        }
        return experienceLevel;
    }

    /**
     * Niveau de séniorité cohérent avec la fourchette retenue. Un poste Expert reste SENIOR :
     * l'énumération métier n'a que trois échelons.
     */
    public static JobOffer.SeniorityLevel reconcileSeniority(JobOffer.SeniorityLevel seniority,
                                                             String experienceLabel) {
        Integer parsed = parseMinYears(experienceLabel);
        if (parsed != null) {
            return seniorityForMinYears(parsed);
        }
        return seniority;
    }

    private static Integer firstMatch(Pattern pattern, String req) {
        Matcher m = pattern.matcher(req);
        if (m.find()) {
            int years = Integer.parseInt(m.group(1));
            return years > 0 && years <= 35 ? years : null;
        }
        return null;
    }

    private static String ascii(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }
}
