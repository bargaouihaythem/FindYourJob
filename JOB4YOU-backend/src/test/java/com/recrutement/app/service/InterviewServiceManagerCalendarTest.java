package com.recrutement.app.service;

import com.recrutement.app.dto.InterviewResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("InterviewService - Calendrier manager sécurisé")
class InterviewServiceManagerCalendarTest {

    @Mock InterviewRepository interviewRepository;
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock NotificationService notificationService;
    @Mock N8nService n8nService;
    @Mock AuditLogService auditLogService;
    @Mock ReminderService reminderService;
    @Mock AccessControlService accessControlService;
    @Mock CandidateService candidateService;

    @InjectMocks InterviewService interviewService;

    @Test
    @DisplayName("le calendrier manager ne renvoie que ses propres entretiens, dans son périmètre")
    void shouldOnlyReturnOwnInterviewsInsideManagerScope() {
        LocalDateTime start = LocalDateTime.of(2026, 8, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 8, 31, 23, 59);
        Interview qaInterview = interview(1L, "Candidat QA", "Ingénieur QA", 7L);
        Interview devOpsInterview = interview(2L, "Candidat DevOps", "Ingénieur DevOps", 7L);
        Interview colleagueInterview = interview(3L, "Candidat Collision", "Ingénieur QA", 8L);

        when(accessControlService.currentUserId()).thenReturn(7L);
        when(interviewRepository.findInRangeWithRelations(start, end))
                .thenReturn(List.of(qaInterview, devOpsInterview, colleagueInterview));
        when(accessControlService.canAccessCandidate(qaInterview.getCandidate())).thenReturn(true);
        when(accessControlService.canAccessCandidate(devOpsInterview.getCandidate())).thenReturn(false);

        List<InterviewResponse> result = interviewService.getManagerCalendar(start, end);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(1L);
        assertThat(result.get(0).getCandidateName()).isEqualTo("Candidat QA");
        assertThat(result.get(0).getJobOfferTitle()).isEqualTo("Ingénieur QA");
        verify(accessControlService).canAccessCandidate(qaInterview.getCandidate());
        verify(accessControlService).canAccessCandidate(devOpsInterview.getCandidate());
        // L'entretien d'un confrère n'est jamais examiné au titre du périmètre :
        // le filtre « intervieweur » s'applique avant le filtre métier.
        verify(accessControlService, never()).canAccessCandidate(colleagueInterview.getCandidate());
    }

    @Test
    @DisplayName("un calendrier sans utilisateur authentifié reste vide")
    void shouldReturnEmptyCalendarWithoutAuthenticatedUser() {
        LocalDateTime start = LocalDateTime.of(2026, 8, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 8, 31, 23, 59);
        when(accessControlService.currentUserId()).thenReturn(null);

        assertThat(interviewService.getManagerCalendar(start, end)).isEmpty();
        verify(interviewRepository, never()).findInRangeWithRelations(any(), any());
    }

    @Test
    @DisplayName("l’accès direct à un entretien hors périmètre est refusé")
    void shouldDenyDirectInterviewAccessOutsideManagerScope() {
        Interview devOpsInterview = interview(2L, "Candidat DevOps", "Ingénieur DevOps", 7L);
        when(interviewRepository.findById(2L)).thenReturn(Optional.of(devOpsInterview));
        doThrow(new AccessDeniedException("Le candidat ne fait pas partie de votre périmètre"))
                .when(accessControlService).assertCanAccessCandidate(devOpsInterview.getCandidate());

        assertThatThrownBy(() -> interviewService.getInterviewById(2L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("périmètre");
    }

    @Test
    @DisplayName("un entretien inexistant conserve la réponse métier attendue")
    void shouldKeepNotFoundResponseForMissingInterview() {
        when(interviewRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interviewService.getInterviewById(404L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("404");
    }

    private Interview interview(Long id, String candidateName, String offerTitle, Long interviewerId) {
        String[] names = candidateName.split(" ", 2);
        JobOffer offer = new JobOffer();
        offer.setId(id + 100L);
        offer.setTitle(offerTitle);

        Candidate candidate = new Candidate();
        candidate.setId(id + 200L);
        candidate.setFirstName(names[0]);
        candidate.setLastName(names.length > 1 ? names[1] : "");
        candidate.setEmail("candidate" + id + "@example.test");
        candidate.setJobOffer(offer);

        User interviewer = new User();
        interviewer.setId(interviewerId);
        interviewer.setUsername("manager" + interviewerId);

        Interview interview = new Interview();
        interview.setId(id);
        interview.setCandidate(candidate);
        interview.setInterviewer(interviewer);
        interview.setInterviewDate(LocalDateTime.of(2026, 8, 12, 10, 0).plusDays(id));
        interview.setType(Interview.InterviewType.TECHNICAL);
        interview.setStatus(Interview.InterviewStatus.SCHEDULED);
        interview.setDurationMinutes(60);
        interview.setLocation("Visioconférence");
        return interview;
    }
}
