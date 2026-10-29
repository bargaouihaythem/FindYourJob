package com.recrutement.app.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.recrutement.app.entity.N8nOutboxEvent;
import com.recrutement.app.repository.N8nOutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.net.SocketTimeoutException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** File durable pour les événements n8n déclenchés par les changements métier. */
@Service
public class N8nOutboxService {

    private static final Logger log = LoggerFactory.getLogger(N8nOutboxService.class);
    private static final int MAX_ATTEMPTS = 5;

    private final N8nOutboxEventRepository repository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final String apiKey;

    @Value("${n8n.outbox.enabled:true}")
    private boolean enabled;

    public N8nOutboxService(N8nOutboxEventRepository repository,
                            ObjectMapper objectMapper,
                            @Qualifier("n8nRestTemplate") RestTemplate restTemplate,
                            @Value("${n8n.api.key:}") String apiKey) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
    }

    @Transactional
    public void enqueue(String eventKey, String webhookUrl, String agentName, Map<String, Object> payload) {
        if (!enabled || webhookUrl == null || webhookUrl.isBlank()) {
            return;
        }
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            LocalDateTime now = LocalDateTime.now();
            N8nOutboxEvent event = repository.findByEventKey(eventKey).orElse(null);
            if (event == null) {
                repository.save(new N8nOutboxEvent(eventKey, webhookUrl, agentName, payloadJson, now));
                return;
            }

            if (event.getStatus() == N8nOutboxEvent.Status.SENT
                    || event.getStatus() == N8nOutboxEvent.Status.PENDING) {
                return;
            }

            event.setWebhookUrl(webhookUrl);
            event.setAgentName(agentName);
            event.setPayloadJson(payloadJson);
            event.setStatus(N8nOutboxEvent.Status.PENDING);
            event.setNextAttemptAt(now);
            event.setLastError(null);
            repository.save(event);
        } catch (Exception e) {
            log.error("Impossible d’enregistrer l’événement n8n {}", eventKey, e);
        }
    }

    /**
     * Événements de notification déjà enregistrés pour ce dossier (lecture RH) :
     * toutes les tentatives initiales et relances, dans l'ordre chronologique.
     */
    public List<N8nOutboxEvent> findRoutingEvents(Long candidateId) {
        return repository.findByEventKeyStartingWithOrderByCreatedAtAsc(
                N8nService.agent3RoutingKeyPrefix(candidateId));
    }

    @Scheduled(fixedDelayString = "${n8n.outbox.poll-ms:5000}")
    @Transactional
    public void dispatchPendingEvents() {
        if (!enabled) {
            return;
        }
        List<N8nOutboxEvent> events = repository.findPendingForUpdate(
                LocalDateTime.now(), PageRequest.of(0, 20));
        for (N8nOutboxEvent event : events) {
            dispatchOne(event);
        }
    }

    private void dispatchOne(N8nOutboxEvent event) {
        try {
            Map<String, Object> payload = objectMapper.readValue(
                    event.getPayloadJson(), new TypeReference<>() {});
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (apiKey != null && !apiKey.isBlank()) {
                headers.set("X-N8N-API-Key", apiKey);
            }
            restTemplate.postForEntity(event.getWebhookUrl(), new HttpEntity<>(payload, headers), String.class);
            event.setStatus(N8nOutboxEvent.Status.SENT);
            event.setSentAt(LocalDateTime.now());
            event.setLastError(null);
            repository.save(event);
            log.info("[N8N outbox] événement envoyé : {}", event.getAgentName());
        } catch (Exception e) {
            int attempts = event.getAttempts() + 1;
            event.setAttempts(attempts);
            event.setLastError(safeError(e));
            if (delivreeMalgreTimeout(e)) {
                // Le webhook a été atteint : n8n exécute le workflow (Calendar + Gmail) et
                // l'envoi a pu partir alors même que la réponse nous échappe. Réessayer
                // produirait un doublon dans la boîte du candidat.
                event.setStatus(N8nOutboxEvent.Status.FAILED);
                log.warn("[N8N outbox] réponse lue après délai d'attente pour {} : la remise est "
                        + "incertaine, aucune relance automatique (relance manuelle possible)",
                        event.getAgentName());
            } else if (attempts >= MAX_ATTEMPTS) {
                event.setStatus(N8nOutboxEvent.Status.FAILED);
                log.error("[N8N outbox] événement abandonné après {} tentatives : {}", attempts, event.getAgentName());
            } else {
                event.setStatus(N8nOutboxEvent.Status.PENDING);
                long delaySeconds = Math.min(300, 5L * (1L << Math.min(attempts - 1, 5)));
                event.setNextAttemptAt(LocalDateTime.now().plusSeconds(delaySeconds));
                log.warn("[N8N outbox] échec tentative {}/{} pour {} ; nouvelle tentative dans {} s",
                        attempts, MAX_ATTEMPTS, event.getAgentName(), delaySeconds);
            }
            repository.save(event);
        }
    }

    /**
     * Un délai d'attente en LECTURE signifie que la requête est partie et que n8n a eu le
     * temps de la recevoir ; un délai en CONNEXION (ou un refus) signifie qu'aucun
     * destinataire n'a été touché. Seuls ces derniers rendent une relance sans risque.
     */
    private boolean delivreeMalgreTimeout(Exception e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SocketTimeoutException) {
                return !(t.getMessage() != null && t.getMessage().toLowerCase().contains("connect"));
            }
        }
        return false;
    }

    private String safeError(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return message.length() > 900 ? message.substring(0, 900) : message;
    }
}
