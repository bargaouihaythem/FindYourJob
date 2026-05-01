package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour {@link N8nService}.
 *
 * Tests couverts :
 * - triggerAgent1CvParser()      : no-op si webhook vide, appelle POST si configuré
 * - triggerAgent2HrValidation()  : no-op si webhook vide, appelle POST si configuré
 * - sendWithRetry()              : retry sur ResourceAccessException (max 2 retries)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("N8nService - Tests unitaires")
class N8nServiceTest {

    @Mock
    RestTemplate restTemplate;

    @InjectMocks
    N8nService n8nService;

    private static final String FAKE_WEBHOOK = "http://localhost:5678/webhook/test";

    @BeforeEach
    void setUp() {
        // Injecter le RestTemplate via constructeur déjà fait par @InjectMocks
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private Candidate makeCandidate(Long id) {
        Candidate c = new Candidate();
        c.setId(id);
        c.setFirstName("Marie");
        c.setLastName("Curie");
        c.setEmail("marie@example.com");
        c.setStatus(CandidateStatus.APPLIED);
        c.setApplicationDate(LocalDateTime.now());
        return c;
    }

    // ────────────────────────────────────────────────────────────────────
    // triggerAgent1CvParser()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("triggerAgent1CvParser()")
    class TriggerAgent1Tests {

        @Test
        @DisplayName("ne fait aucun appel HTTP si le webhook Agent 1 n'est pas configuré")
        void shouldDoNothingWhenWebhookEmpty() {
            ReflectionTestUtils.setField(n8nService, "agent1Webhook", "");

            n8nService.triggerAgent1CvParser(makeCandidate(1L));

            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("appelle POST sur le webhook Agent 1 si configuré")
        void shouldCallWebhookWhenConfigured() {
            ReflectionTestUtils.setField(n8nService, "agent1Webhook", FAKE_WEBHOOK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("OK"));

            n8nService.triggerAgent1CvParser(makeCandidate(2L));

            verify(restTemplate).postForEntity(eq(FAKE_WEBHOOK), any(HttpEntity.class), eq(String.class));
        }

        @Test
        @DisplayName("inclut candidatId dans le payload envoyé à Agent 1")
        void shouldIncludeCandidateIdInPayload() {
            ReflectionTestUtils.setField(n8nService, "agent1Webhook", FAKE_WEBHOOK);

            ArgumentCaptor<HttpEntity<Object>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.postForEntity(anyString(), captor.capture(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("OK"));

            Candidate c = makeCandidate(42L);
            n8nService.triggerAgent1CvParser(c);

            Object body = captor.getValue().getBody();
            assertThat(body.toString()).contains("42");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // triggerAgent2HrValidation()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("triggerAgent2HrValidation()")
    class TriggerAgent2Tests {

        @Test
        @DisplayName("ne fait aucun appel HTTP si le webhook Agent 2 n'est pas configuré")
        void shouldDoNothingWhenWebhookEmpty() {
            ReflectionTestUtils.setField(n8nService, "agent2Webhook", "");

            n8nService.triggerAgent2HrValidation(1L, "marie@example.com", "Marie", "Curie", "Offre Test", null, null);

            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("appelle POST sur le webhook Agent 2 avec statut CV_REVIEWED")
        void shouldCallWebhookWithCvReviewedStatus() {
            ReflectionTestUtils.setField(n8nService, "agent2Webhook", FAKE_WEBHOOK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("OK"));

            n8nService.triggerAgent2HrValidation(5L, "marie@example.com", "Marie", "Curie", "Offre Test", "CV_REVIEWED", null);

            verify(restTemplate).postForEntity(eq(FAKE_WEBHOOK), any(HttpEntity.class), eq(String.class));
        }

        @Test
        @DisplayName("payload contient l'événement DOSSIER_VALIDE_RH")
        void shouldSendCorrectEventInPayload() {
            ReflectionTestUtils.setField(n8nService, "agent2Webhook", FAKE_WEBHOOK);

            ArgumentCaptor<HttpEntity<Object>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.postForEntity(anyString(), captor.capture(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("OK"));

            n8nService.triggerAgent2HrValidation(7L, "marie@example.com", "Marie", "Curie", "Offre Test", "CV_REVIEWED", null);

            Object body = captor.getValue().getBody();
            assertThat(body.toString()).contains("DOSSIER_VALIDE_RH");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Retry logic (sendWithRetry via triggerAgent1)
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Logique de retry (sendWithRetry)")
    class RetryLogicTests {

        @Test
        @DisplayName("réessaie jusqu'à MAX_RETRIES fois sur ResourceAccessException puis abandonne")
        void shouldRetryOnResourceAccessException() {
            ReflectionTestUtils.setField(n8nService, "agent1Webhook", FAKE_WEBHOOK);

            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new ResourceAccessException("timeout"))
                    .thenThrow(new ResourceAccessException("timeout"))
                    .thenThrow(new ResourceAccessException("timeout"));

            // Ne doit pas lancer d'exception — les erreurs sont loggées
            org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                    () -> n8nService.triggerAgent1CvParser(makeCandidate(1L))
            );

            // 1 tentative initiale + 2 retries = 3 appels max
            verify(restTemplate, atMost(3)).postForEntity(anyString(), any(), any());
        }

        @Test
        @DisplayName("réussit au 2ème essai après 1 échec")
        void shouldSucceedOnSecondAttempt() {
            ReflectionTestUtils.setField(n8nService, "agent1Webhook", FAKE_WEBHOOK);

            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new ResourceAccessException("timeout"))
                    .thenReturn(ResponseEntity.ok("OK"));

            org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                    () -> n8nService.triggerAgent1CvParser(makeCandidate(2L))
            );

            verify(restTemplate, times(2)).postForEntity(anyString(), any(), any());
        }
    }
}
