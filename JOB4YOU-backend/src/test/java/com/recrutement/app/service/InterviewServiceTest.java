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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link InterviewService}.
 *
 * Le cloisonnement par périmètre (AccessControlService) est déjà couvert par
 * {@link InterviewServiceManagerCalendarTest}. Cette classe couvre la RÉPARTITION des rôles :
 * planifier un entretien écrit l'agenda ici, et ne touche jamais le statut du candidat
 * directement. L'avancée de l'étape de pipeline est déléguée à {@link CandidateService}, qui
 * seule connaît la machine à états. Une délégation refusée par cette machine laisse le dossier
 * en place sans annuler l'entretien.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("InterviewService - agenda et avancement délégué")
class InterviewServiceTest {

    @Mock InterviewRepository interviewRepository;
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock NotificationService notificationService;
    @Mock N8nService n8nService;
    @Mock AuditLogService auditLogService;
    @Mock ReminderService reminderService;
    @Mock AccessControlService accessControlService;
    @Mock CandidateService candidateService;

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
    @DisplayName("InterviewService ne change jamais le statut de son propre fait")
    void shouldNeverWriteStatusItself() {
        Candidate cand = candidate(1L, Candidate.CandidateStatus.PHONE_SCREENING);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("rh1");

        when(candidateRepository.findById(1L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.scheduleInterview(request(1L, Interview.InterviewType.TECHNICAL));

        // L'agenda est écrit ici ; le dossier, lui, n'est jamais persisté par ce service.
        assertThat(cand.getStatus()).isEqualTo(Candidate.CandidateStatus.PHONE_SCREENING);
        verify(candidateRepository, never()).save(any(Candidate.class));
    }

    @Test
    @DisplayName("planifier un entretien technique délègue l'avancée à l'étape TECHNICAL_TEST")
    void shouldDelegateTechnicalStepToStateMachine() {
        Candidate cand = candidate(11L, Candidate.CandidateStatus.PHONE_SCREENING);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("rh1");

        when(candidateRepository.findById(11L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.scheduleInterview(request(11L, Interview.InterviewType.TECHNICAL));

        verify(candidateService).advanceForScheduledInterview(eq(11L),
                eq(Candidate.CandidateStatus.TECHNICAL_TEST), anyString());
    }

    @Test
    @DisplayName("planifier un entretien avec le manager vise l'étape INTERVIEW")
    void shouldDelegateManagerInterviewToInterviewStep() {
        Candidate cand = candidate(12L, Candidate.CandidateStatus.TECHNICAL_TEST);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("manager.cs");

        when(candidateRepository.findById(12L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.scheduleInterview(request(12L, Interview.InterviewType.MANAGER));

        verify(candidateService).advanceForScheduledInterview(eq(12L),
                eq(Candidate.CandidateStatus.INTERVIEW), anyString());
    }

    @Test
    @DisplayName("une avancée refusée par la machine à états n'annule pas l'entretien planifié")
    void shouldKeepInterviewWhenAdvanceIsRefused() {
        // Dossier déjà engagé : la machine refuse de revenir en arrière. Le créneau reste
        // réservé et l'e-mail part quand même — sinon le manager planifierait en vain.
        Candidate cand = candidate(13L, Candidate.CandidateStatus.FINAL_INTERVIEW);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("rh1");

        when(candidateRepository.findById(13L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(candidateService.advanceForScheduledInterview(eq(13L),
                eq(Candidate.CandidateStatus.TECHNICAL_TEST), anyString()))
                .thenReturn(Candidate.CandidateStatus.FINAL_INTERVIEW);

        interviewService.scheduleInterview(request(13L, Interview.InterviewType.TECHNICAL));

        verify(interviewRepository).save(any(Interview.class));
        verify(notificationService).sendInterviewInvitation(any(Interview.class));
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
    @DisplayName("un manager pur ne peut pas affecter l'entretien à un autre intervieweur")
    void shouldRefuseInterviewerAssignmentByPureManager() {
        Candidate cand = candidate(6L, Candidate.CandidateStatus.CV_REVIEWED);
        User peer = new User();
        peer.setId(99L);
        peer.setUsername("manager.devops");

        when(candidateRepository.findById(6L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(peer));
        when(accessControlService.currentIsPureManager()).thenReturn(true);
        when(accessControlService.currentUserId()).thenReturn(2L);

        assertThatThrownBy(() ->
                interviewService.scheduleInterview(request(6L, Interview.InterviewType.TECHNICAL)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("que pour vous-même");

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("un manager pur peut planifier un entretien pour lui-même : il apparaît dans son calendrier")
    void shouldAllowSelfInterviewerForPureManager() {
        Candidate cand = candidate(7L, Candidate.CandidateStatus.CV_REVIEWED);
        User self = new User();
        self.setId(99L);
        self.setUsername("manager.cs");

        when(candidateRepository.findById(7L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(self));
        when(accessControlService.currentIsPureManager()).thenReturn(true);
        when(accessControlService.currentUserId()).thenReturn(99L);
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.scheduleInterview(request(7L, Interview.InterviewType.TECHNICAL));

        verify(interviewRepository).save(any(Interview.class));
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

    private Interview interview(Long id, Candidate.CandidateStatus dossierStatus,
                                Interview.InterviewStatus interviewStatus) {
        Interview interview = new Interview();
        interview.setId(id);
        interview.setInterviewDate(LocalDateTime.now().minusDays(1));
        interview.setType(Interview.InterviewType.MANAGER);
        interview.setStatus(interviewStatus);
        interview.setCandidate(candidate(id + 500L, dossierStatus));
        return interview;
    }

    @Test
    @DisplayName("un dossier déjà tranché par le RH bloque toute modification de son entretien")
    void shouldRefuseStatusChangeOnDecidedDossier() {
        Interview interview = interview(21L, Candidate.CandidateStatus.HIRED,
                Interview.InterviewStatus.SCHEDULED);
        when(interviewRepository.findById(21L)).thenReturn(Optional.of(interview));

        assertThatThrownBy(() -> interviewService.updateInterviewStatus(21L,
                Interview.InterviewStatus.COMPLETED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("déjà tranché");

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("refuser l'annulation d'un entretien dont le dossier est embauché")
    void shouldRefuseCancellationOnHiredDossier() {
        // Sans ce garde, le manager enverrait un e-mail d'annulation à un candidat que le RH
        // vient d'embaucher.
        Interview interview = interview(22L, Candidate.CandidateStatus.REJECTED,
                Interview.InterviewStatus.SCHEDULED);
        when(interviewRepository.findById(22L)).thenReturn(Optional.of(interview));

        assertThatThrownBy(() -> interviewService.updateInterviewStatus(22L,
                Interview.InterviewStatus.CANCELLED))
                .isInstanceOf(IllegalArgumentException.class);

        verify(notificationService, never()).sendInterviewCancellation(any());
        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("un refus proposé par le manager reste rejouable : l'entretien se clôture")
    void shouldAllowClosingInterviewOfManagerRefusal() {
        // MANAGER_REJECTED n'est qu'une proposition : le RH n'a pas encore arbitré, et le manager
        // doit pouvoir marquer comme effectué l'entretien qui a produit ce refus.
        Interview interview = interview(23L, Candidate.CandidateStatus.MANAGER_REJECTED,
                Interview.InterviewStatus.SCHEDULED);
        when(interviewRepository.findById(23L)).thenReturn(Optional.of(interview));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = interviewService.updateInterviewStatus(23L, Interview.InterviewStatus.COMPLETED);

        assertThat(response.getStatus()).isEqualTo(Interview.InterviewStatus.COMPLETED);
        verify(interviewRepository).save(any(Interview.class));
    }

    @Test
    @DisplayName("un manager pur ne peut pas rouvrir un entretien déjà effectué")
    void shouldRefuseReopeningByPureManager() {
        Interview interview = interview(24L, Candidate.CandidateStatus.INTERVIEW,
                Interview.InterviewStatus.COMPLETED);
        when(interviewRepository.findById(24L)).thenReturn(Optional.of(interview));
        when(accessControlService.currentIsPureManager()).thenReturn(true);

        assertThatThrownBy(() -> interviewService.updateInterviewStatus(24L,
                Interview.InterviewStatus.SCHEDULED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("seul le RH");

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("le RH peut rouvrir un entretien clôturé à tort")
    void shouldAllowHrReopening() {
        Interview interview = interview(25L, Candidate.CandidateStatus.INTERVIEW,
                Interview.InterviewStatus.COMPLETED);
        when(interviewRepository.findById(25L)).thenReturn(Optional.of(interview));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = interviewService.updateInterviewStatus(25L, Interview.InterviewStatus.SCHEDULED);

        assertThat(response.getStatus()).isEqualTo(Interview.InterviewStatus.SCHEDULED);
    }

    @Test
    @DisplayName("re-soumettre le même statut d'un dossier tranché n'est pas refusé")
    void shouldAllowIdempotentStatusOnDecidedDossier() {
        // Le frontend renvoie parfois la ligne telle quelle : seuls les VRAIS changements sont
        // refusés, sinon l'écran se bloque sans raison.
        Interview interview = interview(26L, Candidate.CandidateStatus.HIRED,
                Interview.InterviewStatus.COMPLETED);
        when(interviewRepository.findById(26L)).thenReturn(Optional.of(interview));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        interviewService.updateInterviewStatus(26L, Interview.InterviewStatus.COMPLETED);

        verify(interviewRepository).save(any(Interview.class));
    }

    private Interview booked(Long id, LocalDateTime start, int minutes, Interview.InterviewStatus status) {
        Interview booked = new Interview();
        booked.setId(id);
        booked.setInterviewDate(start);
        booked.setDurationMinutes(minutes);
        booked.setStatus(status);
        booked.setType(Interview.InterviewType.MANAGER);
        booked.setCandidate(candidate(id, Candidate.CandidateStatus.INTERVIEW));
        return booked;
    }

    /** Entretien à `minutes` après 9 h 00, durée 30 min, pour l'intervieweur 99. */
    private InterviewRequest requestAt(int minutesAfterNine, int duration) {
        InterviewRequest r = request(31L, Interview.InterviewType.MANAGER);
        r.setInterviewDate(LocalDateTime.of(2026, 11, 5, 9, 0).plusMinutes(minutesAfterNine));
        r.setDurationMinutes(duration);
        return r;
    }

    private void stubSchedulePath(Candidate.CandidateStatus dossierStatus) {
        Candidate cand = candidate(31L, dossierStatus);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("manager.devops");

        when(candidateRepository.findById(31L)).thenReturn(Optional.of(cand));
        when(userRepository.findById(99L)).thenReturn(Optional.of(interviewer));
        // Le refus de chevauchement part avant le save : cette stub n'est donc pas toujours bue.
        lenient().when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("deux entretiens qui se chevauchent pour le même intervieweur sont refusés")
    void shouldRefuseOverlappingInterviews() {
        // 09:30-10:15 est déjà pris : demander 09:00-10:00 est physiquement impossible.
        stubSchedulePath(Candidate.CandidateStatus.TECHNICAL_TEST);
        when(interviewRepository.findByInterviewerIdAndInterviewDateBetween(eq(99L), any(), any()))
                .thenReturn(List.of(booked(40L, LocalDateTime.of(2026, 11, 5, 9, 30), 45,
                        Interview.InterviewStatus.SCHEDULED)));

        assertThatThrownBy(() -> interviewService.scheduleInterview(requestAt(0, 60)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("chevauche");

        verify(interviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("plusieurs entretiens le même jour sont autorisés s'ils ne se recouvrent pas")
    void shouldAllowSeveralInterviewsSameDay() {
        // C'est le cas demandé par l'auteur : une journée chargée reste planifiable.
        stubSchedulePath(Candidate.CandidateStatus.TECHNICAL_TEST);
        when(interviewRepository.findByInterviewerIdAndInterviewDateBetween(eq(99L), any(), any()))
                .thenReturn(List.of(
                        booked(41L, LocalDateTime.of(2026, 11, 5, 9, 0), 45, Interview.InterviewStatus.SCHEDULED),
                        booked(42L, LocalDateTime.of(2026, 11, 5, 10, 0), 45, Interview.InterviewStatus.SCHEDULED)));

        interviewService.scheduleInterview(requestAt(5 * 60, 60)); // 14:00

        verify(interviewRepository).save(any(Interview.class));
    }

    @Test
    @DisplayName("des entretiens qui se suivent sans temps mort restent acceptés")
    void shouldAllowBackToBackInterviews() {
        stubSchedulePath(Candidate.CandidateStatus.TECHNICAL_TEST);
        when(interviewRepository.findByInterviewerIdAndInterviewDateBetween(eq(99L), any(), any()))
                .thenReturn(List.of(booked(43L, LocalDateTime.of(2026, 11, 5, 9, 0), 60,
                        Interview.InterviewStatus.SCHEDULED)));

        interviewService.scheduleInterview(requestAt(60, 60)); // 10:00 pile après

        verify(interviewRepository).save(any(Interview.class));
    }

    @Test
    @DisplayName("un entretien annulé libère son créneau")
    void shouldIgnoreCancelledInterviewWhenCheckingOverlap() {
        stubSchedulePath(Candidate.CandidateStatus.TECHNICAL_TEST);
        when(interviewRepository.findByInterviewerIdAndInterviewDateBetween(eq(99L), any(), any()))
                .thenReturn(List.of(booked(44L, LocalDateTime.of(2026, 11, 5, 9, 0), 60,
                        Interview.InterviewStatus.CANCELLED)));

        interviewService.scheduleInterview(requestAt(0, 60));

        verify(interviewRepository).save(any(Interview.class));
    }

    @Test
    @DisplayName("modifier un entretien sur son propre créneau n'est pas un conflit avec lui-même")
    void shouldNotConflictWithItselfOnUpdate() {
        LocalDateTime sameSlot = LocalDateTime.of(2026, 11, 5, 9, 0);
        Candidate cand = candidate(31L, Candidate.CandidateStatus.INTERVIEW);
        User interviewer = new User();
        interviewer.setId(99L);
        interviewer.setUsername("manager.devops");

        Interview existing = booked(45L, sameSlot, 60, Interview.InterviewStatus.SCHEDULED);
        existing.setCandidate(cand);
        existing.setInterviewer(interviewer);

        when(interviewRepository.findById(45L)).thenReturn(Optional.of(existing));
        when(interviewRepository.findByInterviewerIdAndInterviewDateBetween(eq(99L), any(), any()))
                .thenReturn(List.of(existing));
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        InterviewRequest update = requestAt(0, 45);
        update.setCandidateId(31L);
        update.setInterviewerId(99L);

        interviewService.updateInterview(45L, update);

        verify(interviewRepository).save(any(Interview.class));
    }
}
