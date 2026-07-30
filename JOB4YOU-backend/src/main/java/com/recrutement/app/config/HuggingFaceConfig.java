package com.recrutement.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate dédié aux appels vers les API d'inférence externes (Cohere,
 * HuggingFace) — utilisé par AiScoringService (scoring d'un candidat) et
 * MatchingService (classement de plusieurs offres en un seul appel, prompt
 * plus long donc plus lent à répondre).
 *
 * Timeouts configurables via application.properties :
 *   huggingface.http.connect-timeout-ms (défaut : 5000 ms)
 *   huggingface.http.read-timeout-ms    (défaut : 30000 ms)
 */
@Configuration
public class HuggingFaceConfig {

    @Value("${huggingface.http.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${huggingface.http.read-timeout-ms:30000}")
    private int readTimeoutMs;

    @Bean("huggingFaceRestTemplate")
    public RestTemplate huggingFaceRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
    }
}
