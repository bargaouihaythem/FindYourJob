package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Tests unitaires pour {@link NotificationService}.
 *
 * Ce qui est verrouillé ici : un avis de manager produit UN SEUL message RH, quel que
 * soit le nombre de comptes RH. La boîte du jury ne doit pas contenir quatre copies du
 * même avis — c'est le comportement qui a été signalé comme un doute sur la chaîne.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService - Tests unitaires")
class NotificationServiceTest {

    @Mock EmailService emailService;

    @InjectMocks
    NotificationService notificationService;

    private Candidate candidate() {
        JobOffer jobOffer = new JobOffer();
        jobOffer.setTitle("Ingénieur Sécurité DevSecOps");
        Candidate candidate = new Candidate();
        candidate.setFirstName("Test");
        candidate.setLastName("Ing");
        candidate.setEmail("candidat@exemple.com");
        candidate.setJobOffer(jobOffer);
        return candidate;
    }

    private User manager() {
        User manager = new User();
        manager.setUsername("manager.devops");
        manager.setFirstName("Marc");
        manager.setLastName("Devops");
        return manager;
    }

    @Test
    @DisplayName("un avis favorable notifie les RH en un seul message, tous destinataires réunis")
    void sendManagerDecisionToHr_envoieUnSeulMessagePourTousLesRh() {
        notificationService.sendManagerDecisionToHr(candidate(), Candidate.CandidateStatus.ACCEPTED,
                manager(), List.of("rh@job4you.com", "bargaouihaythem1+rh@gmail.com"));

        ArgumentCaptor<String> recipients = ArgumentCaptor.forClass(String.class);
        verify(emailService, times(1)).sendTemplateEmail(recipients.capture(), anyString(),
                eq("emails/manager-decision-hr"), anyMap());

        assertThat(recipients.getValue())
                .isEqualTo("rh@job4you.com, bargaouihaythem1+rh@gmail.com")
                .doesNotContain(";");
    }

    @Test
    @DisplayName("l'objet de l'e-mail distingue l'avis favorable de la proposition de refus")
    void sendManagerDecisionToHr_adapteLObjetALaDecision() {
        notificationService.sendManagerDecisionToHr(candidate(), Candidate.CandidateStatus.ACCEPTED,
                manager(), List.of("rh@job4you.com"));
        notificationService.sendManagerDecisionToHr(candidate(), Candidate.CandidateStatus.MANAGER_REJECTED,
                manager(), List.of("rh@job4you.com"));

        ArgumentCaptor<String> subjects = ArgumentCaptor.forClass(String.class);
        verify(emailService, times(2)).sendTemplateEmail(anyString(), subjects.capture(),
                eq("emails/manager-decision-hr"), anyMap());
        assertThat(subjects.getAllValues())
                .containsExactly("Avis favorable à valider — Test Ing / Ingénieur Sécurité DevSecOps",
                        "Refus proposé à valider — Test Ing / Ingénieur Sécurité DevSecOps");
    }
}
