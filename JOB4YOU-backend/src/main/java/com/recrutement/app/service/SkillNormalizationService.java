package com.recrutement.app.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service de normalisation des compétences et d'explicabilité du matching (Remarque 3).
 *
 * Fonctionnalités clés :
 * 1. Harmonisation des alias et variantes d'écriture (ex: "k8s" -> "Kubernetes", "postgres" -> "PostgreSQL").
 * 2. Maintien strict des distinctions technologiques (pas de fusion abusive) :
 *    - Spring Boot != Spring Cloud
 *    - Angular != AngularJS
 *    - Java != JavaScript
 *    - Python != PySpark
 * 3. Extraction d'explicabilité : compétences correspondantes (matched), compétences manquantes (missing),
 *    compétences additionnelles (bonus), et synthèse explicative pour le recruteur.
 */
@Service
public class SkillNormalizationService {

    private static final Logger log = LoggerFactory.getLogger(SkillNormalizationService.class);

    // Dictionnaire d'équivalences strictes (clé en minuscule -> libellé normalisé officiel)
    private static final Map<String, String> SKILL_CANONICAL_MAP = new LinkedHashMap<>();

    static {
        // Java & Écosystème (Spring Boot et Spring Cloud sont strictement séparés)
        registerCanonical("java", "Java");
        registerCanonical("java 17", "Java");
        registerCanonical("java 21", "Java");
        registerCanonical("java 11", "Java");
        registerCanonical("java 8", "Java");
        registerCanonical("spring boot", "Spring Boot");
        registerCanonical("springboot", "Spring Boot");
        registerCanonical("spring-boot", "Spring Boot");
        registerCanonical("spring cloud", "Spring Cloud");
        registerCanonical("springcloud", "Spring Cloud");
        registerCanonical("spring security", "Spring Security");
        registerCanonical("spring data", "Spring Data");
        registerCanonical("spring", "Spring");
        registerCanonical("hibernate", "Hibernate");
        registerCanonical("jpa", "JPA");
        registerCanonical("maven", "Maven");
        registerCanonical("gradle", "Gradle");

        // JavaScript / TypeScript & Frameworks Frontend (Angular et AngularJS sont strictement séparés)
        registerCanonical("javascript", "JavaScript");
        registerCanonical("js", "JavaScript");
        registerCanonical("typescript", "TypeScript");
        registerCanonical("ts", "TypeScript");
        registerCanonical("angular", "Angular");
        registerCanonical("angular 15", "Angular");
        registerCanonical("angular 16", "Angular");
        registerCanonical("angular 17", "Angular");
        registerCanonical("angularjs", "AngularJS");
        registerCanonical("angular.js", "AngularJS");
        registerCanonical("angular 1", "AngularJS");
        registerCanonical("react", "React");
        registerCanonical("reactjs", "React");
        registerCanonical("react.js", "React");
        registerCanonical("vue", "Vue.js");
        registerCanonical("vuejs", "Vue.js");
        registerCanonical("vue.js", "Vue.js");
        registerCanonical("node", "Node.js");
        registerCanonical("nodejs", "Node.js");
        registerCanonical("node.js", "Node.js");

        // Bases de données
        registerCanonical("postgresql", "PostgreSQL");
        registerCanonical("postgres", "PostgreSQL");
        registerCanonical("psql", "PostgreSQL");
        registerCanonical("mongodb", "MongoDB");
        registerCanonical("mongo", "MongoDB");
        registerCanonical("mysql", "MySQL");
        registerCanonical("oracle", "Oracle DB");
        registerCanonical("redis", "Redis");
        registerCanonical("sql", "SQL");

        // DevOps & Cloud
        registerCanonical("docker", "Docker");
        registerCanonical("kubernetes", "Kubernetes");
        registerCanonical("k8s", "Kubernetes");
        registerCanonical("terraform", "Terraform");
        registerCanonical("tf", "Terraform");
        registerCanonical("ansible", "Ansible");
        registerCanonical("jenkins", "Jenkins");
        registerCanonical("gitlab-ci", "GitLab CI");
        registerCanonical("gitlab ci", "GitLab CI");
        registerCanonical("github actions", "GitHub Actions");
        registerCanonical("aws", "AWS");
        registerCanonical("amazon web services", "AWS");
        registerCanonical("azure", "Azure");
        registerCanonical("microsoft azure", "Azure");
        registerCanonical("gcp", "GCP");
        registerCanonical("google cloud", "GCP");
        registerCanonical("prometheus", "Prometheus");
        registerCanonical("grafana", "Grafana");
        registerCanonical("bash", "Bash");
        registerCanonical("shell", "Shell/Bash");
        registerCanonical("linux", "Linux");

        // Data & Python (Python et PySpark sont séparés)
        registerCanonical("python", "Python");
        registerCanonical("python3", "Python");
        registerCanonical("pyspark", "PySpark");
        registerCanonical("spark", "Apache Spark");
        registerCanonical("pandas", "Pandas");
        registerCanonical("numpy", "NumPy");
        registerCanonical("scikit-learn", "Scikit-Learn");
        registerCanonical("tensorflow", "TensorFlow");
        registerCanonical("tableau", "Tableau");
        registerCanonical("power bi", "Power BI");
        registerCanonical("powerbi", "Power BI");

        // Métiers Sopra HR : SIRH, Paie, Analyse Fonctionnelle & Gestion de projet
        registerCanonical("sirh", "SIRH");
        registerCanonical("hris", "SIRH");
        registerCanonical("paie", "Paie");
        registerCanonical("payroll", "Paie");
        registerCanonical("gestion des temps", "GTA");
        registerCanonical("gta", "GTA");
        registerCanonical("analyse fonctionnelle", "Analyse Fonctionnelle");
        registerCanonical("business analysis", "Business Analysis");
        registerCanonical("cahier des charges", "Cahier des charges");
        registerCanonical("recette", "Recette & Tests fonctionnels");
        registerCanonical("recette fonctionnelle", "Recette & Tests fonctionnels");
        registerCanonical("agile", "Agile");
        registerCanonical("scrum", "Scrum");
        registerCanonical("jira", "Jira");
        registerCanonical("confluence", "Confluence");
        registerCanonical("uml", "UML");
    }

    private static void registerCanonical(String raw, String canonical) {
        SKILL_CANONICAL_MAP.put(raw.toLowerCase(Locale.ROOT), canonical);
    }

    public static class MatchingExplanation {
        private List<String> matchedSkills = new ArrayList<>();
        private List<String> missingSkills = new ArrayList<>();
        private List<String> bonusSkills = new ArrayList<>();
        private Integer candidateExperienceYears;
        private Integer requiredExperienceMinYears;
        private String seniorityMatchLabel;
        private double technicalMatchRate; // 0.0 - 1.0
        private String detailedJustification;

        public List<String> getMatchedSkills() { return matchedSkills; }
        public void setMatchedSkills(List<String> matchedSkills) { this.matchedSkills = matchedSkills; }

        public List<String> getMissingSkills() { return missingSkills; }
        public void setMissingSkills(List<String> missingSkills) { this.missingSkills = missingSkills; }

        public List<String> getBonusSkills() { return bonusSkills; }
        public void setBonusSkills(List<String> bonusSkills) { this.bonusSkills = bonusSkills; }

        public Integer getCandidateExperienceYears() { return candidateExperienceYears; }
        public void setCandidateExperienceYears(Integer candidateExperienceYears) { this.candidateExperienceYears = candidateExperienceYears; }

        public Integer getRequiredExperienceMinYears() { return requiredExperienceMinYears; }
        public void setRequiredExperienceMinYears(Integer requiredExperienceMinYears) { this.requiredExperienceMinYears = requiredExperienceMinYears; }

        public String getSeniorityMatchLabel() { return seniorityMatchLabel; }
        public void setSeniorityMatchLabel(String seniorityMatchLabel) { this.seniorityMatchLabel = seniorityMatchLabel; }

        public double getTechnicalMatchRate() { return technicalMatchRate; }
        public void setTechnicalMatchRate(double technicalMatchRate) { this.technicalMatchRate = technicalMatchRate; }

        public String getDetailedJustification() { return detailedJustification; }
        public void setDetailedJustification(String detailedJustification) { this.detailedJustification = detailedJustification; }
    }

    /**
     * Normalise une chaîne brute de compétence vers son libellé officiel.
     * Si inconnue, nettoie la chaîne sans la dénaturer.
     */
    public String normalizeSkill(String rawSkill) {
        if (rawSkill == null || rawSkill.isBlank()) return "";
        String clean = rawSkill.trim().toLowerCase(Locale.ROOT);
        return SKILL_CANONICAL_MAP.getOrDefault(clean, capitalizeWords(rawSkill.trim()));
    }

    /**
     * Normalise une liste de compétences séparées par virgules.
     */
    public Set<String> normalizeSkillList(String commaSeparatedSkills) {
        Set<String> result = new LinkedHashSet<>();
        if (commaSeparatedSkills == null || commaSeparatedSkills.isBlank()) return result;

        for (String part : commaSeparatedSkills.split("[,;\\n]")) {
            String norm = normalizeSkill(part);
            if (!norm.isBlank()) {
                result.add(norm);
            }
        }
        return result;
    }

    /**
     * Analyse les compétences et l'expérience d'un candidat par rapport à une offre.
     */
    public MatchingExplanation analyzeMatching(String candidateText, String requiredSkillsStr, String requiredExperienceLevel) {
        MatchingExplanation explanation = new MatchingExplanation();
        String textLower = candidateText != null ? candidateText.toLowerCase(Locale.ROOT) : "";

        // 1. Découpage et normalisation des compétences requises
        Set<String> requiredSet = normalizeSkillList(requiredSkillsStr);

        // 2. Détection des compétences présentes dans le texte du candidat
        Set<String> matched = new LinkedHashSet<>();
        Set<String> missing = new LinkedHashSet<>();

        for (String reqSkill : requiredSet) {
            if (isSkillPresentInText(reqSkill, textLower)) {
                matched.add(reqSkill);
            } else {
                missing.add(reqSkill);
            }
        }

        // 3. Détection des compétences bonus présentes dans le CV
        Set<String> bonus = new LinkedHashSet<>();
        for (Map.Entry<String, String> entry : SKILL_CANONICAL_MAP.entrySet()) {
            String canonical = entry.getValue();
            if (!requiredSet.contains(canonical) && isSkillPresentInText(canonical, textLower)) {
                bonus.add(canonical);
            }
        }

        // 4. Extraction des années d'expérience dans le texte
        Integer expYears = extractExperienceYears(textLower);
        explanation.setCandidateExperienceYears(expYears);
        explanation.setRequiredExperienceMinYears(extractRequiredMinYears(requiredExperienceLevel));

        // 5. Évaluation adéquation séniorité
        String seniorityEval = evaluateSeniority(expYears, requiredExperienceLevel, textLower);
        explanation.setSeniorityMatchLabel(seniorityEval);

        explanation.setMatchedSkills(new ArrayList<>(matched));
        explanation.setMissingSkills(new ArrayList<>(missing));
        explanation.setBonusSkills(bonus.stream().limit(6).collect(Collectors.toList()));

        double matchRate = requiredSet.isEmpty() ? 1.0 : (double) matched.size() / requiredSet.size();
        explanation.setTechnicalMatchRate(matchRate);

        // 6. Justification explicative (XAI)
        StringBuilder justification = new StringBuilder();
        int matchedPct = (int) Math.round(matchRate * 100);
        justification.append("Adéquation technique : ").append(matchedPct).append("% (")
                .append(matched.size()).append("/").append(requiredSet.size()).append(" compétences requises validées). ");

        if (!matched.isEmpty()) {
            justification.append("Compétences clés maîtrisées : ").append(String.join(", ", matched)).append(". ");
        }
        if (!missing.isEmpty()) {
            justification.append("Compétences manquantes à évaluer : ").append(String.join(", ", missing)).append(". ");
        }
        if (expYears != null) {
            justification.append("Expérience détectée : environ ").append(expYears).append(" an(s) (").append(seniorityEval).append(").");
        } else {
            justification.append("Profil séniorité : ").append(seniorityEval).append(".");
        }

        explanation.setDetailedJustification(justification.toString());
        return explanation;
    }

    /**
     * Vérification de présence d'une compétence dans le texte avec respect des frontières de mot
     * pour éviter les faux positifs (ex: "Java" ne doit pas matcher sur "JavaScript"), et des
     * frontières de négation pour éviter les faux acquis.
     *
     * La négation est traitée par segment : « N'a pas encore manipulé Kubernetes ni les clouds
     * publics AWS/GCP » ne doit pas faire remonter Kubernetes, AWS ni GCP dans matchedSkills.
     * Ce n'est pas un détail de notation : cette liste est recopiée telle quelle dans la
     * justification XAI lue par le RH (« Compétences clés maîtrisées : … »).
     */
    public boolean isSkillPresentInText(String canonicalSkill, String textLower) {
        if (canonicalSkill == null || textLower == null || textLower.isBlank()) return false;
        Pattern pattern = presencePattern(canonicalSkill.toLowerCase(Locale.ROOT));
        if (pattern == null) return false;

        Matcher matcher = pattern.matcher(textLower);
        while (matcher.find()) {
            if (!isNegatedInSegment(textLower, matcher.start())) return true;
        }
        return false;
    }

    /**
     * Motif de présence d'une compétence (alias compris) : la frontière de mot n'est posée que
     * pour les compétences qui se noient dans un mot plus long (java/javascript, angular/angularjs).
     */
    private Pattern presencePattern(String skillLower) {
        switch (skillLower) {
            case "java":
                return Pattern.compile("(?<![a-z0-9])java(?![a-z0-9]|script)", Pattern.CASE_INSENSITIVE);
            case "angular":
                return Pattern.compile("(?<![a-z0-9])angular(?![a-z0-9]|js)", Pattern.CASE_INSENSITIVE);
            case "spring boot":
                return Pattern.compile("spring boot|springboot|spring-boot", Pattern.CASE_INSENSITIVE);
            case "spring cloud":
                return Pattern.compile("spring cloud|springcloud", Pattern.CASE_INSENSITIVE);
            case "kubernetes":
                return Pattern.compile("kubernetes|k8s", Pattern.CASE_INSENSITIVE);
            case "postgresql":
                return Pattern.compile("postgresql|postgres|psql", Pattern.CASE_INSENSITIVE);
            case "typescript":
                return Pattern.compile("(?<![a-z0-9])(typescript|ts)(?![a-z0-9])", Pattern.CASE_INSENSITIVE);
            default:
                return Pattern.compile("(?<![a-z0-9])" + Pattern.quote(skillLower) + "(?![a-z0-9])",
                        Pattern.CASE_INSENSITIVE);
        }
    }

    /**
     * Début de segment : ponctuation forte, virgule et deux-points. La portée d'une négation
     * s'arrête à ces séparateurs, sinon « sans gestion d'équipe : Java » effacerait Java.
     */
    private static final Pattern SEGMENT_START = Pattern.compile("[.;:!?\\n,]");

    /** Négations françaises et anglaises courantes, en mot entier pour éviter « formation »/« ligne ». */
    private static final Pattern NEGATION_CUE = Pattern.compile(
            "(?:^|[^a-z0-9])(sans|aucun|aucune|pas|jamais|ni|non|without|no\\s+experience)(?:[^a-z0-9]|$)",
            Pattern.CASE_INSENSITIVE);

    /**
     * Une compétence est niée si une négation apparaît avant elle dans le même segment.
     * Après, ce n'est plus sa portée : « Spring Boot et je n'ai pas Azure » garde Spring Boot.
     */
    private boolean isNegatedInSegment(String textLower, int skillStart) {
        int segmentStart = 0;
        Matcher separator = SEGMENT_START.matcher(textLower);
        while (separator.find() && separator.start() < skillStart) {
            segmentStart = separator.end();
        }
        return NEGATION_CUE.matcher(textLower.substring(segmentStart, skillStart)).find();
    }

    /**
     * Extraction heuristique du nombre d'années d'expérience dans le texte.
     */
    public Integer extractExperienceYears(String textLower) {
        if (textLower == null || textLower.isBlank()) return null;

        // Évite de confondre les versions d'outils ("Java 17", "Angular 16") avec des années d'expérience
        Pattern pattern = Pattern.compile("(?<!java\\s|angular\\s|node\\s|vue\\s|react\\s|python\\s|symfony\\s)(\\b\\d{1,2})\\s*(?:\\+)?\\s*(?:ans?|années?|years?)(?:\\s*(?:d'expérience|d’expérience|experience))?", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(textLower);
        int maxYears = 0;
        while (matcher.find()) {
            try {
                int y = Integer.parseInt(matcher.group(1));
                if (y > 0 && y <= 35) { // filtrer les valeurs aberrantes
                    if (y > maxYears) maxYears = y;
                }
            } catch (Exception ignored) {}
        }
        return maxYears > 0 ? maxYears : null;
    }

    /**
     * Minimum d'années exigé par une offre, lu dans son `experienceLevel` libre
     * (« 5-8 ans », « 5+ ans », « à partir de 3 ans d'expérience », « Senior », « Étudiant »).
     * La lecture est celle du barème métier (ExperienceLevelNorms) : c'est le même point
     * d'appui que la normalisation des offres à la saisie, sinon l'offre et le scoring
     * pourraient ne pas entendre la même exigence.
     */
    public Integer extractRequiredMinYears(String requiredLevel) {
        return ExperienceLevelNorms.parseMinYears(requiredLevel);
    }

    private String evaluateSeniority(Integer candidateYears, String requiredLevel, String textLower) {
        if (requiredLevel == null || requiredLevel.isBlank()) {
            return candidateYears != null ? candidateYears + " ans d'expérience" : "Niveau indéterminé";
        }
        Integer requiredMin = extractRequiredMinYears(requiredLevel);
        if (candidateYears != null && requiredMin != null) {
            if (requiredMin == 0) {
                return candidateYears <= 2 ? "Conforme aux attentes Junior" : "Surqualifié pour poste Junior";
            }
            if (candidateYears >= requiredMin) {
                return "Expérience conforme au minimum requis (" + requiredMin + " an(s) demandé, "
                        + candidateYears + " an(s) détecté(s))";
            }
            int gap = requiredMin - candidateYears;
            return gap == 1
                    ? "Léger déficit d'expérience (" + candidateYears + " an(s) pour un minimum de " + requiredMin + ")"
                    : "Expérience insuffisante (" + candidateYears + " an(s) pour un minimum de " + requiredMin + " an(s) exigé par l'offre)";
        }
        String req = requiredLevel.toLowerCase(Locale.ROOT);
        if (candidateYears != null && (req.contains("mid") || req.contains("interm"))) {
            return candidateYears >= 2 && candidateYears <= 6 ? "Conforme au niveau recherché (Intermédiaire/Confirmé)"
                    : candidateYears < 2 ? "Expérience inférieure au seuil demandé" : "Profil plus expérimenté que requis";
        }
        if (candidateYears == null) {
            return "Expérience du candidat non détectée dans le CV";
        }

        if (textLower.contains("senior") || textLower.contains("lead") || textLower.contains("architecte")) {
            return "Profil qualifié Senior par intitulés de poste";
        }
        if (textLower.contains("junior") || textLower.contains("débutant") || textLower.contains("stage")) {
            return "Profil orienté Junior / Débutant";
        }
        return "Adéquation globale acceptable";
    }

    private String capitalizeWords(String str) {
        if (str == null || str.isEmpty()) return str;
        String[] words = str.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0)));
                if (w.length() > 1) sb.append(w.substring(1));
                sb.append(" ");
            }
        }
        return sb.toString().trim();
    }
}
