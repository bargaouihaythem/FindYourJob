package com.recrutement.app.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limiteur léger pour les endpoints sensibles. En production multi-instance,
 * remplacer par un stockage partagé (Redis/API gateway).
 */
@Service
public class RateLimitService {

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public boolean allow(String key, int maxAttempts, Duration duration) {
        Instant now = Instant.now();
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || current.expiresAt.isBefore(now)) {
                return new Window(now.plus(duration), 1);
            }
            if (current.attempts >= maxAttempts) {
                current.attempts++;
                return current;
            }
            current.attempts++;
            return current;
        });
        cleanup(now);
        return window.attempts <= maxAttempts;
    }

    private void cleanup(Instant now) {
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
        }
    }

    private static final class Window {
        private final Instant expiresAt;
        private int attempts;

        private Window(Instant expiresAt, int attempts) {
            this.expiresAt = expiresAt;
            this.attempts = attempts;
        }
    }
}
