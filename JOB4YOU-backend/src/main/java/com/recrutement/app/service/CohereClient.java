package com.recrutement.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Client pour l'API Cohere (Chat) — utilisé comme moteur d'IA pour le
 * scoring des candidatures (remplace HuggingFace, bloqué par la politique
 * réseau Sopra Steria sur le sous-domaine api-inference.huggingface.co).
 *
 * api.cohere.com est accessible depuis ce réseau (vérifié).
 *
 * Le modèle reçoit un prompt structuré et doit répondre avec un JSON
 * {"technique":0-100,"communication":0-100,"seniorite":0-100}.
 * Si l'appel échoue (réseau, quota, clé absente…), une IllegalStateException
 * est levée et AiScoringService bascule automatiquement en mode simulé.
 */
@Component
public class CohereClient {

    private static final Logger log = LoggerFactory.getLogger(CohereClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${cohere.api.token:}")
    private String apiToken;

    @Value("${cohere.api.url:https://api.cohere.com/v2/chat}")
    private String apiUrl;

    @Value("${cohere.model:command-r-08-2024}")
    private String model;

    private final RestTemplate restTemplate;

    public CohereClient(@Qualifier("huggingFaceRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return apiToken != null && !apiToken.isBlank();
    }

    public static class ScoreBreakdown {
        public int technical;
        public int communication;
        public int seniority;
    }

    /**
     * Demande à Cohere d'évaluer un candidat par rapport à une offre et de
     * retourner un score par critère (0-100).
     *
     * @throws IllegalStateException si le token n'est pas configuré ou si l'appel échoue
     */
    public ScoreBreakdown scoreCandidate(String candidateText, String jobTitle, String requiredSkills, String experienceLevel) {
        if (!isConfigured()) {
            throw new IllegalStateException("Token Cohere non configuré (cohere.api.token)");
        }

        String prompt = "Tu es un assistant de recrutement expert. Évalue objectivement le candidat ci-dessous "
                + "pour le poste indiqué. Réponds UNIQUEMENT avec un JSON valide, sans texte autour, au format exact : "
                + "{\"technique\": <entier 0-100>, \"communication\": <entier 0-100>, \"seniorite\": <entier 0-100>}\n\n"
                + "technique = adéquation des compétences du candidat avec les compétences requises\n"
                + "communication = qualité et professionnalisme de la communication écrite du candidat\n"
                + "seniorite = adéquation entre le niveau d'expérience du candidat et le niveau requis par le poste\n\n"
                + "IMPORTANT : n'utilise JAMAIS 0 par défaut. Si les informations fournies sont insuffisantes pour "
                + "juger un critère avec certitude, utilise une valeur neutre de 50 pour ce critère plutôt que 0. "
                + "Le score 0 doit uniquement refléter une preuve claire et explicite d'inadéquation totale.\n\n"
                + "Poste : " + (jobTitle != null ? jobTitle : "non précisé") + "\n"
                + "Niveau requis : " + (experienceLevel != null ? experienceLevel : "non précisé") + "\n"
                + "Compétences requises : " + (requiredSkills != null ? requiredSkills : "non précisées") + "\n\n"
                + "Profil / lettre de motivation du candidat :\n" + candidateText;

        Map<String, Object> body = Map.of(
                "model", model,
                "temperature", 0,
                "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiToken);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(apiUrl, entity, Map.class);
            if (response == null) {
                throw new IllegalStateException("Réponse Cohere vide");
            }

            String text = extractText(response);
            return parseScores(text);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[Cohere] Appel échoué ({}) — fallback simulé activé", e.getMessage());
            throw new IllegalStateException("Appel Cohere échoué : " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        Object messageObj = response.get("message");
        if (!(messageObj instanceof Map)) {
            throw new IllegalStateException("Réponse Cohere sans champ 'message' : " + response);
        }
        Map<String, Object> message = (Map<String, Object>) messageObj;
        Object contentObj = message.get("content");
        if (!(contentObj instanceof List) || ((List<?>) contentObj).isEmpty()) {
            throw new IllegalStateException("Réponse Cohere sans contenu : " + response);
        }
        Map<String, Object> firstBlock = (Map<String, Object>) ((List<?>) contentObj).get(0);
        Object textObj = firstBlock.get("text");
        if (textObj == null) {
            throw new IllegalStateException("Réponse Cohere sans texte : " + response);
        }
        return textObj.toString();
    }

    private ScoreBreakdown parseScores(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end < 0 || end <= start) {
            throw new IllegalStateException("Pas de JSON trouvé dans la réponse Cohere : " + text);
        }
        String json = text.substring(start, end + 1);

        try {
            JsonNode node = MAPPER.readTree(json);
            ScoreBreakdown breakdown = new ScoreBreakdown();
            breakdown.technical = clamp(firstPresentInt(node, 70, "technique", "technical", "competences_techniques"));
            breakdown.communication = clamp(firstPresentInt(node, 70, "communication", "communications"));
            breakdown.seniority = clamp(firstPresentInt(node, 70, "seniorite", "seniority", "senior"));

            // Garde-fou : si le modèle a répondu avec des clés totalement différentes,
            // les 3 valeurs seraient à 0 (asInt sur un champ manquant renvoie 0 si le
            // nœud parent existe mais pas le champ demandé dans certains cas de forme).
            // On retente une extraction brute des 3 premiers entiers du JSON dans ce cas.
            if (breakdown.technical == 0 && breakdown.communication == 0 && breakdown.seniority == 0) {
                List<Integer> ints = extractFirstThreeIntegers(json);
                if (ints.size() == 3) {
                    breakdown.technical = clamp(ints.get(0));
                    breakdown.communication = clamp(ints.get(1));
                    breakdown.seniority = clamp(ints.get(2));
                }
            }

            return breakdown;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("JSON Cohere invalide : " + json, e);
        }
    }

    private int firstPresentInt(JsonNode node, int defaultValue, String... keys) {
        for (String key : keys) {
            JsonNode value = node.get(key);
            if (value != null && !value.isMissingNode() && !value.isNull() && value.canConvertToInt()) {
                return value.asInt();
            }
        }
        return defaultValue;
    }

    private List<Integer> extractFirstThreeIntegers(String json) {
        List<Integer> result = new java.util.ArrayList<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("-?\\d+").matcher(json);
        while (m.find() && result.size() < 3) {
            result.add(Integer.parseInt(m.group()));
        }
        return result;
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
