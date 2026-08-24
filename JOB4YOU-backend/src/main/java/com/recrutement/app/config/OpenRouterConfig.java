package com.recrutement.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate dédié aux appels vers l'API OpenRouter (chatbot candidat).
 * Timeout de lecture plus long que les intégrations de scoring : une réponse
 * de chat conversationnel peut prendre plus de temps qu'un scoring JSON court.
 *
 * Timeouts configurables via application.properties :
 *   openrouter.http.connect-timeout-ms (défaut : 5000 ms)
 *   openrouter.http.read-timeout-ms    (défaut : 30000 ms)
 */
@Configuration
public class OpenRouterConfig {

    @Value("${openrouter.http.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${openrouter.http.read-timeout-ms:30000}")
    private int readTimeoutMs;

    @Bean("openRouterRestTemplate")
    public RestTemplate openRouterRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
    }
}
