package com.recrutement.app.service;

import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.JobOfferRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour {@link CandidateService}.
 *
 * Tests couverts :
 * - getValidatedCandidatesForManager() : filtre par statuts validés
 * - updateCandidateStatus()            : persistance + déclenchement Agent 2
 * - getCandidatesByStatus()            : délégation au repository
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CandidateService - Tests unitaires")
class CandidateServiceTest {

    @Mock CandidateRepository candidateRepository;
    @Mock JobOfferRepository  jobOfferRepository;
    @Mock CVRepository        cvRepository;
    @Mock LocalFileStorageService localFileStorageService;
    @Mock NotificationService notificationService;
    @Mock N8nService          n8nService;

    @InjectMocks
    CandidateService candidateService;

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private Candidate makeCandidate(Long id, CandidateStatus status) {
        Candidate c = new Candidate();
        c.setId(id);
        c.setFirstName("Alice");
        c.setLastName("Dupont");
        c.setEmail("alice@example.com");
        c.setPhone("0600000000");
        c.setStatus(status);
        c.setApplicationDate(LocalDateTime.now());
        c.setLastUpdated(LocalDateTime.now());
        return c;
    }

    // ────────────────────────────────────────────────────────────────────
    // getValidatedCandidatesForManager()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getValidatedCandidatesForManager()")
    class GetValidatedCandidatesForManagerTests {

        @Test
        @DisplayName("retourne uniquement les candidats aux statuts validés par RH")
        void shouldReturnOnlyValidatedStatuses() {
            Candidate cvReviewed  = makeCandidate(1L, CandidateStatus.CV_REVIEWED);
            Candidate interview   = makeCandidate(2L, CandidateStatus.INTERVIEW);
            Candidate accepted    = makeCandidate(3L, CandidateStatus.ACCEPTED);

            when(candidateRepository.findByStatusIn(anyList()))
                    .thenReturn(List.of(cvReviewed, interview, accepted));

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager();

            assertThat(result).hasSize(3);
            assertThat(result).extracting("status")
                    .containsExactlyInAnyOrder(
                            CandidateStatus.CV_REVIEWED,
                            CandidateStatus.INTERVIEW,
                            CandidateStatus.ACCEPTED);
        }

        @Test
        @DisplayName("appelle findByStatusIn avec les 6 statuts attendus (hors APPLIED, REJECTED, WITHDRAWN)")
        void shouldQueryWithCorrectStatuses() {
            when(candidateRepository.findByStatusIn(anyList())).thenReturn(List.of());

            candidateService.getValidatedCandidatesForManager();

            verify(candidateRepository).findByStatusIn(argThat(statuses -> {
                List<CandidateStatus> s = (List<CandidateStatus>) statuses;
                return s.contains(CandidateStatus.CV_REVIEWED)
                    && s.contains(CandidateStatus.PHONE_SCREENING)
                    && s.contains(CandidateStatus.TECHNICAL_TEST)
                    && s.contains(CandidateStatus.INTERVIEW)
                    && s.contains(CandidateStatus.FINAL_INTERVIEW)
                    && s.contains(CandidateStatus.ACCEPTED)
                    && !s.contains(CandidateStatus.APPLIED)
                    && !s.contains(CandidateStatus.REJECTED)
                    && !s.contains(CandidateStatus.WITHDRAWN);
            }));
        }

        @Test
        @DisplayName("retourne liste vide si aucun candidat validé")
        void shouldReturnEmptyListWhenNone() {
            when(candidateRepository.findByStatusIn(anyList())).thenReturn(List.of());

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager();

            assertThat(result).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // updateCandidateStatus()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateCandidateStatus()")
    class UpdateCandidateStatusTests {

        @Test
        @DisplayName("persiste le nouveau statut et déclenche Agent 2 quand statut = CV_REVIEWED")
        void shouldTriggerAgent2WhenCvReviewed() {
            Candidate candidate = makeCandidate(10L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(10L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(10L, CandidateStatus.CV_REVIEWED);

            verify(candidateRepository).save(argThat(c -> c.getStatus() == CandidateStatus.CV_REVIEWED));
            verify(n8nService).triggerAgent3HrValidation(eq(10L), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), any());
        }

        @Test
        @DisplayName("ne déclenche PAS Agent 2 pour les autres statuts")
        void shouldNotTriggerAgent2ForOtherStatuses() {
            Candidate candidate = makeCandidate(11L, CandidateStatus.CV_REVIEWED);
            when(candidateRepository.findById(11L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(11L, CandidateStatus.INTERVIEW);

            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("met à jour lastUpdated lors du changement de statut")
        void shouldUpdateLastUpdated() {
            LocalDateTime before = LocalDateTime.now().minusSeconds(1);
            Candidate candidate = makeCandidate(12L, CandidateStatus.APPLIED);
            candidate.setLastUpdated(before);

            when(candidateRepository.findById(12L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(12L, CandidateStatus.PHONE_SCREENING);

            verify(candidateRepository).save(argThat(c ->
                    c.getLastUpdated() != null && !c.getLastUpdated().equals(before)
            ));
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si candidat inexistant")
        void shouldThrowWhenCandidateNotFound() {
            when(candidateRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(99L, CandidateStatus.APPLIED))
                    .isInstanceOf(com.recrutement.app.exception.ResourceNotFoundException.class);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // getCandidatesByStatus()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getCandidatesByStatus()")
    class GetCandidatesByStatusTests {

        @Test
        @DisplayName("retourne les candidats correspondant au statut demandé")
        void shouldReturnCandidatesWithGivenStatus() {
            Candidate c1 = makeCandidate(1L, CandidateStatus.APPLIED);
            Candidate c2 = makeCandidate(2L, CandidateStatus.APPLIED);
            when(candidateRepository.findByStatus(CandidateStatus.APPLIED))
                    .thenReturn(List.of(c1, c2));

            List<CandidateResponse> result = candidateService.getCandidatesByStatus(CandidateStatus.APPLIED);

            assertThat(result).hasSize(2);
            assertThat(result).extracting("status")
                    .containsOnly(CandidateStatus.APPLIED);
        }

        @Test
        @DisplayName("retourne liste vide si aucun candidat avec ce statut")
        void shouldReturnEmptyWhenNoMatch() {
            when(candidateRepository.findByStatus(CandidateStatus.REJECTED)).thenReturn(List.of());

            List<CandidateResponse> result = candidateService.getCandidatesByStatus(CandidateStatus.REJECTED);

            assertThat(result).isEmpty();
        }
    }
}
