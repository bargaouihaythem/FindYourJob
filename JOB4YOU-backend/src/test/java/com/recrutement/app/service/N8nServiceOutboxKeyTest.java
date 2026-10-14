package com.recrutement.app.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Clé d'idempotence de l'outbox pour la transmission RH → manager.
 *
 * Un événement DOSSIER_VALIDE_RH porte une clé UNIQUE ; deux managers destinataires du
 * même dossier doivent donc produire deux clés distinctes, sinon le second envoi est
 * silencieusement absorbé par l'outbox et son manager ne reçoit jamais le dossier.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("N8nService - une clé d'outbox par manager destinataire")
class N8nServiceOutboxKeyTest {

    private static final String WEBHOOK = "http://localhost:5678/webhook/agent3";

    @Mock RestTemplate restTemplate;
    @Mock N8nOutboxService outboxService;

    private N8nService n8nService;

    @BeforeEach
    void setUp() {
        n8nService = new N8nService(restTemplate);
        ReflectionTestUtils.setField(n8nService, "agent3Webhook", WEBHOOK);
        ReflectionTestUtils.setField(n8nService, "outboxService", outboxService);
    }

    private void transmitTo(String managerEmail) {
        n8nService.triggerAgent3HrValidation(7L, "candidat@example.com", "Marie", "Curie",
                "Consultant Fonctionnel", "http://localhost/uploads/cv.pdf", "TECHNICAL_TEST",
                managerEmail, "RH");
    }

    @Test
    @DisplayName("deux managers du même dossier produisent deux clés d'événement distinctes")
    void eachRecipientGetsItsOwnEventKey() {
        transmitTo("manager.a@company.com");
        transmitTo("manager.b@company.com");

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(outboxService, times(2))
                .enqueue(keys.capture(), eq(WEBHOOK), anyString(), any());

        assertThat(keys.getAllValues()).containsExactly(
                "7:DOSSIER_VALIDE_RH:TECHNICAL_TEST:manager.a@company.com",
                "7:DOSSIER_VALIDE_RH:TECHNICAL_TEST:manager.b@company.com");
    }

    @Test
    @DisplayName("le même destinataire renvoyé deux fois garde la même clé (l'outbox déduplique)")
    void sameRecipientTwiceKeepsOneKey() {
        transmitTo("manager.a@company.com");
        transmitTo("manager.a@company.com");

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(outboxService, times(2))
                .enqueue(keys.capture(), anyString(), anyString(), any());

        assertThat(List.copyOf(keys.getAllValues()))
                .containsOnly("7:DOSSIER_VALIDE_RH:TECHNICAL_TEST:manager.a@company.com");
    }

    @Test
    @DisplayName("le payload transmis porte bien le manager destinataire concerné")
    void payloadCarriesItsRecipient() {
        transmitTo("manager.b@company.com");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloads = ArgumentCaptor.forClass(Map.class);
        verify(outboxService).enqueue(anyString(), anyString(), anyString(), payloads.capture());

        assertThat(payloads.getValue().toString()).contains("manager.b@company.com");
    }

    @Test
    @DisplayName("webhook non configuré : rien n'est mis dans l'outbox")
    void doesNothingWithoutWebhook() {
        ReflectionTestUtils.setField(n8nService, "agent3Webhook", "");

        transmitTo("manager.a@company.com");

        verify(outboxService, times(0)).enqueue(anyString(), anyString(), anyString(), any());
        verify(restTemplate, times(0)).postForEntity(anyString(), any(), any());
    }

    @Test
    @DisplayName("une relance RH porte une clé inédite, sinon l'outbox l'avalerait en silence")
    void relaunchGetsAFreshKeyThatDedupeCannotSwallow() {
        String first = n8nService.retryAgent3HrValidation(7L, "candidat@example.com", "Marie", "Curie",
                "Consultant Fonctionnel", null, "TECHNICAL_TEST", "manager.a@company.com", "RH relance", 1);
        String second = n8nService.retryAgent3HrValidation(7L, "candidat@example.com", "Marie", "Curie",
                "Consultant Fonctionnel", null, "TECHNICAL_TEST", "manager.a@company.com", "RH relance", 2);

        assertThat(first).isEqualTo("7:DOSSIER_VALIDE_RH:TECHNICAL_TEST:manager.a@company.com:retry-1");
        assertThat(second).isNotEqualTo(first);

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(outboxService, times(2))
                .enqueue(keys.capture(), anyString(), anyString(), any());
        assertThat(keys.getAllValues()).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("la relance d'un envoi sans webhook est signalée au appelant (clé nulle)")
    void relaunchReportsNothingWasQueued() {
        ReflectionTestUtils.setField(n8nService, "agent3Webhook", "");

        String key = n8nService.retryAgent3HrValidation(7L, "candidat@example.com", "Marie", "Curie",
                "Consultant Fonctionnel", null, "TECHNICAL_TEST", "manager.a@company.com", "RH relance", 1);

        assertThat(key).isNull();
        verify(outboxService, times(0)).enqueue(anyString(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("le préfixe de lecture ne capture que les transmissions de ce dossier")
    void readPrefixIsScopedToOneCandidate() {
        assertThat(N8nService.agent3RoutingKeyPrefix(7L))
                .isEqualTo("7:DOSSIER_VALIDE_RH:");
        assertThat(N8nService.agent3RoutingKeyPrefix(7L))
                .isNotEqualTo(N8nService.agent3RoutingKeyPrefix(77L));
    }
}
