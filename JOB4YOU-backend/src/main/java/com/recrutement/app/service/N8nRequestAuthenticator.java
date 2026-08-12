package com.recrutement.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Authentifie les appels serveur-à-serveur provenant de n8n.
 *
 * La comparaison est constante et l'absence de clé configurée est refusée
 * par défaut. Les endpoints n8n ne doivent jamais devenir publics par erreur
 * lorsque la propriété n8n.api.key est vide.
 */
@Component("n8nRequestAuthenticator")
public class N8nRequestAuthenticator {

    private final String configuredApiKey;

    public N8nRequestAuthenticator(@Value("${n8n.api.key:}") String configuredApiKey) {
        this.configuredApiKey = configuredApiKey;
    }

    public boolean isValid(String providedApiKey) {
        if (configuredApiKey == null || configuredApiKey.isBlank()
                || providedApiKey == null || providedApiKey.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                configuredApiKey.getBytes(StandardCharsets.UTF_8),
                providedApiKey.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isConfigured() {
        return configuredApiKey != null && !configuredApiKey.isBlank();
    }
}
