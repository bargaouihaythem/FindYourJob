package com.recrutement.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Configuration du client HTTP (RestTemplate) utilisé par N8nService
 * pour appeler les webhooks n8n.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  RESPONSABILITÉS DANS L'ARCHITECTURE                           │
 * │                                                                 │
 * │  Angular      → Interface utilisateur (candidat, RH, manager)  │
 * │  Spring Boot  → Logique métier, sécurité, base de données       │
 * │  n8n          → Automation IA (emails, scoring, calendrier)     │
 * │  PostgreSQL   → Persistance                                     │
 * │                                                                 │
 * │  Ce bean est utilisé uniquement pour les appels Spring → n8n.  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Timeouts configurables via application.properties :
 *   n8n.http.connect-timeout-ms  (défaut : 3000 ms)
 *   n8n.http.read-timeout-ms     (défaut : 10000 ms)
 */
@Configuration
public class RestTemplateConfig {

    @Value("${n8n.http.connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${n8n.http.read-timeout-ms:10000}")
    private int readTimeoutMs;

    /**
     * RestTemplate dédié aux appels vers n8n.
     * Bean nommé "n8nRestTemplate" pour ne pas écraser un bean global éventuel.
     */
    @Bean("n8nRestTemplate")
    public RestTemplate n8nRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
    }
}
