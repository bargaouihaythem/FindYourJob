package com.recrutement.app.controller;

import com.recrutement.app.service.N8nService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Contrôleur de test/santé pour les webhooks n8n.
 *
 * RESPONSABILITÉS :
 *   - Spring Boot  : vérifie la connectivité HTTP vers n8n, renvoie le résultat
 *   - n8n          : répond au ping avec HTTP 200
 *   - RH / ADMIN   : seuls rôles autorisés à tester la connectivité
 *
 * Endpoints :
 *   GET  /api/n8n/status         → état des URLs configurées (sans les appeler)
 *   POST /api/n8n/test-webhook   → teste un webhook en envoyant un PING
 */
@RestController
@RequestMapping("/api/n8n")
@CrossOrigin(origins = "*")
public class N8nTestController {

    @Value("${n8n.webhook.agent1:}")
    private String agent1Webhook;

    @Value("${n8n.webhook.agent2:}")
    private String agent2Webhook;

    @Value("${n8n.webhook.agent3:}")
    private String agent3Webhook;

    private final N8nService n8nService;

    public N8nTestController(N8nService n8nService) {
        this.n8nService = n8nService;
    }

    /**
     * Vérifie si les URLs des webhooks sont renseignées (sans les appeler).
     * Accessible par ADMIN et HR.
     *
     * Réponse : { agent1Configured: true, agent3Configured: false, ... }
     */
    @GetMapping("/status")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<Map<String, Object>> getWebhookStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("agent1Configured", isConfigured(agent1Webhook));
        status.put("agent2Configured", isConfigured(agent2Webhook));
        status.put("agent3Configured", isConfigured(agent3Webhook));
        status.put("agent1Url", isConfigured(agent1Webhook) ? maskUrl(agent1Webhook) : "(non configuré)");
        status.put("agent2Url", isConfigured(agent2Webhook) ? maskUrl(agent2Webhook) : "(non configuré)");
        status.put("agent3Url", isConfigured(agent3Webhook) ? maskUrl(agent3Webhook) : "(non configuré)");
        status.put("info", "Configurer dans application.properties : n8n.webhook.agent1/agent2/agent3");
        return ResponseEntity.ok(status);
    }

    /**
     * Envoie un PING au webhook spécifié pour vérifier la connectivité.
     * Accessible par ADMIN et HR uniquement.
     *
     * Corps de la requête : { "webhookUrl": "http://localhost:5678/webhook/..." }
     *
     * Réponse : { ok: true, status: 200, message: "...", responseBody: "..." }
     */
    @PostMapping("/test-webhook")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<Map<String, Object>> testWebhook(@RequestBody Map<String, String> body) {
        String webhookUrl = body.get("webhookUrl");
        if (webhookUrl == null || webhookUrl.isBlank()) {
            Map<String, Object> error = new HashMap<>();
            error.put("ok", false);
            error.put("message", "Paramètre 'webhookUrl' manquant dans le corps de la requête");
            return ResponseEntity.badRequest().body(error);
        }

        // Valider que c'est bien une URL n8n pour éviter les appels vers des serveurs externes
        if (!webhookUrl.startsWith("http://localhost") && !webhookUrl.startsWith("https://")) {
            Map<String, Object> error = new HashMap<>();
            error.put("ok", false);
            error.put("message", "URL non autorisée. Utiliser une URL localhost ou https://");
            return ResponseEntity.badRequest().body(error);
        }

        long start = System.currentTimeMillis();
        Map<String, Object> result = n8nService.testWebhook(webhookUrl);
        result.put("responseTimeMs", System.currentTimeMillis() - start);
        result.put("testedUrl", maskUrl(webhookUrl));

        return ResponseEntity.ok(result);
    }

    /**
     * Teste simultanément les 2 webhooks configurés dans application.properties.
     */
    @GetMapping("/test-all")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<Map<String, Object>> testAllWebhooks() {
        Map<String, Object> results = new HashMap<>();

        if (isConfigured(agent1Webhook)) {
            long start = System.currentTimeMillis();
            Map<String, Object> r = n8nService.testWebhook(agent1Webhook);
            r.put("responseTimeMs", System.currentTimeMillis() - start);
            results.put("agent1", r);
        } else {
            results.put("agent1", Map.of("ok", false, "message", "URL non configurée (n8n.webhook.agent1)"));
        }

        if (isConfigured(agent2Webhook)) {
            long start = System.currentTimeMillis();
            Map<String, Object> r = n8nService.testWebhook(agent2Webhook);
            r.put("responseTimeMs", System.currentTimeMillis() - start);
            results.put("agent2", r);
        } else {
            results.put("agent2", Map.of("ok", false, "message", "URL non configurée (n8n.webhook.agent2)"));
        }

        if (isConfigured(agent3Webhook)) {
            long start = System.currentTimeMillis();
            Map<String, Object> r = n8nService.testWebhook(agent3Webhook);
            r.put("responseTimeMs", System.currentTimeMillis() - start);
            results.put("agent3", r);
        } else {
            results.put("agent3", Map.of("ok", false, "message", "URL non configurée (n8n.webhook.agent3)"));
        }

        boolean allOk = results.values().stream()
                .map(v -> (Map<?, ?>) v)
                .allMatch(m -> Boolean.TRUE.equals(m.get("ok")));
        results.put("allReachable", allOk);
        results.put("summary", allOk ? "✅ Tous les webhooks n8n répondent" : "⚠️ Un ou plusieurs webhooks sont inaccessibles");

        return ResponseEntity.ok(results);
    }

    private boolean isConfigured(String url) {
        return url != null && !url.isBlank();
    }

    /** Masque la partie token/path de l'URL pour les logs affichés */
    private String maskUrl(String url) {
        if (url == null) return "";
        // Affiche uniquement host:port + les 8 premiers caractères du path
        try {
            java.net.URI uri = java.net.URI.create(url);
            String path = uri.getPath();
            String shortPath = path.length() > 10 ? path.substring(0, 10) + "..." : path;
            return uri.getScheme() + "://" + uri.getHost()
                    + (uri.getPort() > 0 ? ":" + uri.getPort() : "")
                    + shortPath;
        } catch (Exception e) {
            return url.length() > 30 ? url.substring(0, 30) + "..." : url;
        }
    }
}
