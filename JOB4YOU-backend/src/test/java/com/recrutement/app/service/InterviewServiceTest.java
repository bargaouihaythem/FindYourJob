package com.recrutement.app.service;

import com.recrutement.app.dto.InterviewRequest;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link InterviewService}.
 *
 * Le cloisonnement par périmètre (AccessControlService) est déjà couvert par
 * {@link InterviewServiceManagerCalendarTest}. Cette classe couvre le DÉCOUPLAGE :
 * planifier un entretien est un acte de logistique (agenda) et ne doit plus modifier
 * le statut du candidat — l'avancement du pipeline reste piloté exclusivement par les
 * actions de statut RH/manager (CandidateService), seules garde-fouées par la machine
 * à états.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("InterviewService - découplage entretien / statut")
class InterviewServiceTest {

    @Mock InterviewRepository interviewRepository;
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock NotificationService notificationService;
    @Mock N8nService n8nService;
    @Mock AuditLogService auditLogService;
    @Mock ReminderService reminderService;
    @Mock AccessControlService accessControlService;

    @InjectMocks
    InterviewService interviewService;

    private Candidate candidate(Long id, Candidate.CandidateStatus status) {
        Candidate c = new Candidate();
        c.setId(id);
        c.setFirstName("Jean");
        c.setLastName("Dupont");
        c.setEmail("jean.dupont@example.com");
        c.setStatus(status);
        return c;
    }

    private InterviewRequest request(Long candidateId, Interview.InterviewType type) {
        InterviewRequest r = new InterviewRequest();
        r.setCandidateId(candidateId);
        r.setInterviewerId(99L);
        r.setInterviewDate(LocalDateTime.now().plusDays(1));
        r.setType(type);
        r.setDurationMinutes(30);
        r.setLocation("Visio");
        return r;
    }

    @Test
    @DisplayName("planifier un entretien ne change PAS le statut du candidat (pure logistique)")
    void shouldNotChangeCandidateStatus() {
        Candidate cand = candidate(1L, Candidate.CandidateStatus.CV_REVIEWED);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("rh1");

        when(candidateRepository.findById(1L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.scheduleInterview(request(1L, Interview.InterviewType.TECHNICAL));

        // Le statut reste inchangé : la planification n'avance plus le pipeline.
        assertThat(cand.getStatus()).isEqualTo(Candidate.CandidateStatus.CV_REVIEWED);
        // Le candidat n'est jamais persisté par ce flux (aucune mutation de statut).
        verify(candidateRepository, never()).save(any(Candidate.class));
    }

    @Test
    @DisplayName("planifier sur un dossier clos (retiré/rejeté) est refusé")
    void shouldRejectSchedulingOnClosedDossier() {
        Candidate cand = candidate(2L, Candidate.CandidateStatus.WITHDRAWN);
        when(candidateRepository.findById(2L)).thenReturn(Optional.of(cand));

        assertThatThrownBy(() ->
                interviewService.scheduleInterview(request(2L, Interview.InterviewType.HR)))
                .isInstanceOf(IllegalArgumentException.class);

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("planifier sur un CV non encore examiné (APPLIED) est refusé")
    void shouldRejectSchedulingWhenApplied() {
        Candidate cand = candidate(3L, Candidate.CandidateStatus.APPLIED);
        when(candidateRepository.findById(3L)).thenReturn(Optional.of(cand));

        assertThatThrownBy(() ->
                interviewService.scheduleInterview(request(3L, Interview.InterviewType.PHONE_SCREENING)))
                .isInstanceOf(IllegalArgumentException.class);

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("un manager hors périmètre ne peut pas planifier d'entretien pour ce candidat")
    void shouldEnforceManagerScopeOnSchedule() {
        Candidate cand = candidate(4L, Candidate.CandidateStatus.TECHNICAL_TEST);
        when(candidateRepository.findById(4L)).thenReturn(Optional.of(cand));
        doThrow(new AccessDeniedException("hors périmètre"))
                .when(accessControlService).assertCanAccessCandidate(cand);

        assertThatThrownBy(() ->
                interviewService.scheduleInterview(request(4L, Interview.InterviewType.TECHNICAL)))
                .isInstanceOf(AccessDeniedException.class);

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("saveMeetLink enregistre le lien Google Meet réel transmis par l'agent n8n")
    void shouldSaveRealMeetLink() {
        Interview interview = new Interview();
        interview.setId(5L);
        when(interviewRepository.findById(5L)).thenReturn(Optional.of(interview));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = interviewService.saveMeetLink(5L, "https://meet.google.com/abc-defg-hij");

        assertThat(response.getMeetLink()).isEqualTo("https://meet.google.com/abc-defg-hij");
        assertThat(interview.getMeetLink()).isEqualTo("https://meet.google.com/abc-defg-hij");
        // Callback système déjà gardé par le rôle N8N au niveau contrôleur : pas de
        // vérification de périmètre ici, comme CandidateService.saveAiScore.
        verify(accessControlService, never()).assertCanAccessCandidate(any());
    }
}
