package com.recrutement.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate dédié aux appels vers l'API d'inférence HuggingFace
 * (utilisé par AiScoringService pour le scoring IA par critères).
 *
 * Timeouts configurables via application.properties :
 *   huggingface.http.connect-timeout-ms (défaut : 5000 ms)
 *   huggingface.http.read-timeout-ms    (défaut : 15000 ms)
 */
@Configuration
public class HuggingFaceConfig {

    @Value("${huggingface.http.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${huggingface.http.read-timeout-ms:15000}")
    private int readTimeoutMs;

    @Bean("huggingFaceRestTemplate")
    public RestTemplate huggingFaceRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
    }
}
