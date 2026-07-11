package com.recrutement.app.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Client pour l'API d'inférence HuggingFace (zero-shot-classification).
 *
 * Utilisé par AiScoringService pour évaluer :
 *   - la communication / le professionnalisme du texte du candidat
 *   - le niveau de séniorité perçu (junior / confirmé / senior)
 *
 * Modèle par défaut : facebook/bart-large-mnli (zero-shot-classification).
 * Si le token n'est pas configuré ou si l'appel échoue (réseau, modèle en
 * cours de chargement, quota…), une IllegalStateException est levée et
 * AiScoringService bascule automatiquement sur le mode simulé (fallback).
 */
@Component
public class HuggingFaceClient {

    private static final Logger log = LoggerFactory.getLogger(HuggingFaceClient.class);

    @Value("${huggingface.api.token:}")
    private String apiToken;

    @Value("${huggingface.api.url:https://api-inference.huggingface.co/models/facebook/bart-large-mnli}")
    private String apiUrl;

    private final RestTemplate restTemplate;

    public HuggingFaceClient(@Qualifier("huggingFaceRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return apiToken != null && !apiToken.isBlank();
    }

    /**
     * Classifie un texte par rapport à une liste de labels candidats (zero-shot).
     * Retourne une map label -> score (0.0 à 1.0), triée par score décroissant.
     *
     * @throws IllegalStateException si le token n'est pas configuré ou si l'appel échoue
     */
    @SuppressWarnings("unchecked")
    public Map<String, Double> classify(String text, List<String> candidateLabels) {
        if (!isConfigured()) {
            throw new IllegalStateException("Token HuggingFace non configuré (huggingface.api.token)");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Texte vide, impossible de classifier");
        }

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("candidate_labels", candidateLabels);

        Map<String, Object> body = new HashMap<>();
        body.put("inputs", text);
        body.put("parameters", parameters);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiToken);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            Map<String, Object> response = restTemplate.postForObject(apiUrl, entity, Map.class);
            if (response == null || !response.containsKey("labels") || !response.containsKey("scores")) {
                throw new IllegalStateException("Réponse HuggingFace invalide : " + response);
            }

            List<String> labels = (List<String>) response.get("labels");
            List<Double> scores = (List<Double>) response.get("scores");

            Map<String, Double> result = new LinkedHashMap<>();
            for (int i = 0; i < labels.size() && i < scores.size(); i++) {
                result.put(labels.get(i), scores.get(i));
            }
            return result;
        } catch (Exception e) {
            log.warn("[HuggingFace] Appel échoué ({}) — fallback simulé activé", e.getMessage());
            throw new IllegalStateException("Appel HuggingFace échoué : " + e.getMessage(), e);
        }
    }
}
