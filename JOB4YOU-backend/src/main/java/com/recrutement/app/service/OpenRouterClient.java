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

import java.util.List;
import java.util.Map;

/**
 * Client pour l'API OpenRouter (chat completions, format compatible OpenAI) —
 * utilisé comme moteur du chatbot candidat (ChatbotService).
 *
 * Seul le champ choices[0].message.content est lu. Le champ
 * choices[0].message.reasoning (raisonnement du modèle) n'est jamais exposé :
 * il peut faire référence au contexte interne injecté dans le prompt système.
 *
 * Si l'appel échoue (réseau, quota, clé absente…), une IllegalStateException
 * est levée et ChatbotService renvoie un message de repli au candidat.
 */
@Component
public class OpenRouterClient {

    private static final Logger log = LoggerFactory.getLogger(OpenRouterClient.class);

    @Value("${openrouter.api.token:}")
    private String apiToken;

    @Value("${openrouter.api.url:https://openrouter.ai/api/v1/chat/completions}")
    private String apiUrl;

    @Value("${openrouter.model:stealth/ox-alpha}")
    private String model;

    private final RestTemplate restTemplate;

    public OpenRouterClient(@Qualifier("openRouterRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return apiToken != null && !apiToken.isBlank();
    }

    /**
     * Envoie un message utilisateur au modèle avec un prompt système donné et
     * retourne uniquement le texte de la réponse.
     *
     * @throws IllegalStateException si le token n'est pas configuré ou si l'appel échoue
     */
    public String ask(String systemPrompt, String userMessage) {
        if (!isConfigured()) {
            throw new IllegalStateException("Token OpenRouter non configuré (openrouter.api.token)");
        }

        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userMessage)
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiToken);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(apiUrl, entity, Map.class);
            if (response == null) {
                throw new IllegalStateException("Réponse OpenRouter vide");
            }
            return extractContent(response);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[OpenRouter] Appel échoué ({})", e.getMessage());
            throw new IllegalStateException("Appel OpenRouter échoué : " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List) || ((List<?>) choicesObj).isEmpty()) {
            throw new IllegalStateException("Réponse OpenRouter sans 'choices' : " + response);
        }
        Object firstChoice = ((List<?>) choicesObj).get(0);
        if (!(firstChoice instanceof Map)) {
            throw new IllegalStateException("Réponse OpenRouter mal formée : " + response);
        }
        Object messageObj = ((Map<String, Object>) firstChoice).get("message");
        if (!(messageObj instanceof Map)) {
            throw new IllegalStateException("Réponse OpenRouter sans 'message' : " + response);
        }
        Object contentObj = ((Map<String, Object>) messageObj).get("content");
        if (contentObj == null || contentObj.toString().isBlank()) {
            throw new IllegalStateException("Réponse OpenRouter sans contenu : " + response);
        }
        return contentObj.toString();
    }
}
