package com.recrutement.app.service;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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
    @Mock AuditLogService     auditLogService;
    @Mock CvTextExtractionService cvTextExtractionService;
    @Mock UserRepository      userRepository;
    /**
     * La chaîne d'aiguillage est réelle (Repository simulé) : c'est elle qui décide qui
     * voit quoi. La simuler laisserait les tests de périmètre sans objet.
     */
    @Spy ManagerRoutingService managerRoutingService = new ManagerRoutingService();
    @Spy ManagerScopeService   managerScopeService   = new ManagerScopeService();

    @InjectMocks
    CandidateService candidateService;

    @BeforeEach
    void wireRoutingChain() {
        ReflectionTestUtils.setField(managerRoutingService, "userRepository", userRepository);
        ReflectionTestUtils.setField(managerScopeService, "managerRoutingService", managerRoutingService);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

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

    private Candidate candidateOnOffer(Long id, CandidateStatus status, String managerEmail, Department department) {
        Candidate candidate = makeCandidate(id, status);
        JobOffer jobOffer = new JobOffer();
        jobOffer.setId(1L);
        jobOffer.setManagerEmail(managerEmail);
        jobOffer.setDepartment(department);
        candidate.setJobOffer(jobOffer);
        return candidate;
    }

    /** Dossier déjà transmis : la destination est gelée sur la candidature. */
    private Candidate routedTo(Candidate candidate, String... managerEmails) {
        candidate.setRoutedManagerEmails(String.join(",", managerEmails));
        candidate.setRoutingBasis(RoutingBasis.DEPARTMENT);
        candidate.setRoutedAt(LocalDateTime.now());
        return candidate;
    }

    // ────────────────────────────────────────────────────────────────────
    // getValidatedCandidatesForManager()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getValidatedCandidatesForManager()")
    class GetValidatedCandidatesForManagerTests {

        @Test
        @DisplayName("retourne uniquement les candidats transmis au manager (phase technique+)")
        void shouldReturnOnlyValidatedStatuses() {
            Candidate technical  = makeCandidate(2L, CandidateStatus.TECHNICAL_TEST);
            Candidate interview   = makeCandidate(3L, CandidateStatus.INTERVIEW);
            Candidate accepted    = makeCandidate(4L, CandidateStatus.ACCEPTED);

            when(candidateRepository.findByStatusIn(anyList()))
                    .thenReturn(List.of(technical, interview, accepted));

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager(null);

            assertThat(result).hasSize(3);
            assertThat(result).extracting("status")
                    .containsExactlyInAnyOrder(
                            CandidateStatus.TECHNICAL_TEST,
                            CandidateStatus.INTERVIEW,
                            CandidateStatus.ACCEPTED);
        }

        @Test
        @DisplayName("interroge findByStatusIn à partir de TECHNICAL_TEST (le manager n'intervient qu'après le pré-filtrage RH)")
        void shouldQueryWithCorrectStatuses() {
            when(candidateRepository.findByStatusIn(anyList())).thenReturn(List.of());

            candidateService.getValidatedCandidatesForManager(null);

            verify(candidateRepository).findByStatusIn(argThat(statuses -> {
                List<CandidateStatus> s = (List<CandidateStatus>) statuses;
                return s.contains(CandidateStatus.TECHNICAL_TEST)
                    && s.contains(CandidateStatus.INTERVIEW)
                    && s.contains(CandidateStatus.FINAL_INTERVIEW)
                    && s.contains(CandidateStatus.ACCEPTED)
                    && !s.contains(CandidateStatus.CV_REVIEWED)
                    && !s.contains(CandidateStatus.PHONE_SCREENING)
                    && !s.contains(CandidateStatus.APPLIED)
                    && !s.contains(CandidateStatus.REJECTED)
                    && !s.contains(CandidateStatus.WITHDRAWN);
            }));
        }

        @Test
        @DisplayName("retourne liste vide si aucun candidat validé")
        void shouldReturnEmptyListWhenNone() {
            when(candidateRepository.findByStatusIn(anyList())).thenReturn(List.of());

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager(null);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("un manager (non privilégié) n'obtient que les dossiers dont il est destinataire")
        void shouldReturnOnlyDossiersRoutedToTheManager() {
            Department devops = new Department("DevOps", "DEVOPS");
            devops.setId(2L);

            Candidate forHim = routedTo(
                    candidateOnOffer(70L, CandidateStatus.TECHNICAL_TEST, "manager.cs@company.com", null),
                    "manager.cs@company.com");
            Candidate forSomeoneElse = routedTo(
                    candidateOnOffer(71L, CandidateStatus.TECHNICAL_TEST, "autre@company.com", devops),
                    "manager.devops@company.com");

            User manager = new User();
            manager.setUsername("manager_cs");
            manager.setEmail("manager.cs@company.com");
            manager.setRoles(Set.of(new Role(Role.ERole.ROLE_MANAGER)));

            when(userRepository.findByUsername("manager_cs")).thenReturn(Optional.of(manager));
            when(candidateRepository.findByStatusIn(anyList()))
                    .thenReturn(List.of(forHim, forSomeoneElse));

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager("manager_cs");

            assertThat(result).extracting("id").containsExactly(70L);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // updateCandidateStatus()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateCandidateStatus()")
    class UpdateCandidateStatusTests {

        @Test
        @DisplayName("CV_REVIEWED déclenche l'email candidat (Agent 2) mais PAS encore le manager (Agent 3)")
        void shouldTriggerAgent2WhenCvReviewed() {
            Candidate candidate = makeCandidate(10L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(10L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(10L, CandidateStatus.CV_REVIEWED);

            verify(candidateRepository).save(argThat(c -> c.getStatus() == CandidateStatus.CV_REVIEWED));
            // Le candidat est informé (Agent 2), mais le manager n'est PAS encore notifié :
            // sa notification est déclenchée au passage en TECHNICAL_TEST.
            verify(n8nService).triggerAgent2CvSelected(eq(10L), anyString(), anyString(), anyString(), anyString(), any());
            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("TECHNICAL_TEST transmet le dossier au manager résolu et gèle la destination")
        void shouldNotifyManagerWhenTechnicalTest() {
            Candidate candidate = candidateOnOffer(15L, CandidateStatus.PHONE_SCREENING,
                    "manager.cs@company.com", null);
            candidate.getJobOffer().setTitle("Développeur Java");
            when(candidateRepository.findById(15L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(15L, CandidateStatus.TECHNICAL_TEST);

            verify(n8nService).triggerAgent3HrValidation(eq(15L), anyString(), anyString(), anyString(),
                    eq("Développeur Java"),
                    nullable(String.class), eq("TECHNICAL_TEST"), eq("manager.cs@company.com"), eq("RH"));
            // Le candidat est également informé que son entretien téléphonique est validé.
            verify(notificationService).sendPhoneScreeningValidatedNotification(candidate);
            // Destination gelée sur le dossier : c'est elle qui fera foi ensuite.
            assertThat(candidate.getRoutedManagerEmails()).isEqualTo("manager.cs@company.com");
            assertThat(candidate.getRoutingBasis()).isEqualTo(RoutingBasis.LEGACY_EMAIL);
            assertThat(candidate.getRoutedAt()).isNotNull();
        }

        @Test
        @DisplayName("TECHNICAL_TEST sans manager destinataire bloque : aucune adresse inventée")
        void shouldRefuseTechnicalTestWhenNoManagerResolvable() {
            // Offre sans manager désigné, sans département peuplé, sans famille ni e-mail libre
            Candidate candidate = candidateOnOffer(16L, CandidateStatus.PHONE_SCREENING, null, null);
            Department empty = new Department("HRAccess", "HRACCESS");
            empty.setId(9L);
            candidate.getJobOffer().setDepartment(empty);
            when(candidateRepository.findById(16L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.findManagersByDepartment(9L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of());

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(16L, CandidateStatus.TECHNICAL_TEST))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("aucun manager destinataire");

            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
            verify(auditLogService).log(eq("CANDIDATE"), eq(16L), eq("ROUTING_FAILED"), any(), any());
        }

        @Test
        @DisplayName("ne déclenche PAS Agent 2 pour les autres statuts")
        void shouldNotTriggerAgent2ForOtherStatuses() {
            // PHONE_SCREENING est une transition valide depuis CV_REVIEWED, mais n'est pas
            // CV_REVIEWED → l'agent de notification manager ne doit donc pas se déclencher.
            Candidate candidate = makeCandidate(11L, CandidateStatus.CV_REVIEWED);
            when(candidateRepository.findById(11L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(11L, CandidateStatus.PHONE_SCREENING);

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

            candidateService.updateCandidateStatus(12L, CandidateStatus.CV_REVIEWED);

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

        @Test
        @DisplayName("rejette une transition de statut incohérente (APPLIED → HIRED)")
        void shouldRejectIncoherentTransition() {
            Candidate candidate = makeCandidate(13L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(13L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(13L, CandidateStatus.HIRED))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Transition de statut non autorisée");
            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("autorise la correction manuelle du score : AUTO_REJECTED → CV_REVIEWED")
        void shouldAllowOverrideUnreject() {
            Candidate candidate = makeCandidate(14L, CandidateStatus.AUTO_REJECTED);
            when(candidateRepository.findById(14L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(14L, CandidateStatus.CV_REVIEWED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("le RH peut confirmer un rejet IA : AUTO_REJECTED → REJECTED, motif obligatoire")
        void shouldAllowHrConfirmationOfIaRejection() {
            Candidate candidate = makeCandidate(15L, CandidateStatus.AUTO_REJECTED);
            when(candidateRepository.findById(15L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(15L, CandidateStatus.REJECTED,
                    "Rejet IA examine et confirme : experience hors cible");

            assertThat(candidate.getStatus()).isEqualTo(CandidateStatus.REJECTED);
            assertThat(candidate.getNeedsHumanReview()).isFalse();
        }

        @Test
        @DisplayName("refuser un rejet IA sans motif est refuse")
        void shouldRequireReasonToConfirmIaRejection() {
            Candidate candidate = makeCandidate(16L, CandidateStatus.AUTO_REJECTED);
            when(candidateRepository.findById(16L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(16L, CandidateStatus.REJECTED, "  "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("motif est obligatoire");
            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("ne pas renvoyer un second e-mail de refus quand le RH contreseigne le rejet IA")
        void shouldNotDoubleNotifyRefusalAfterIaRejection() {
            Candidate candidate = makeCandidate(17L, CandidateStatus.AUTO_REJECTED);
            when(candidateRepository.findById(17L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(17L, CandidateStatus.REJECTED, "Decision IA confirmee par le RH");

            verify(notificationService, never()).sendFinalRejection(any());
        }

        @Test
        @DisplayName("envoyer bien l'e-mail de refus sur un refus RH classique (CV_REVIEWED → REJECTED)")
        void shouldStillNotifyFreshHrRejection() {
            Candidate candidate = makeCandidate(18L, CandidateStatus.CV_REVIEWED);
            when(candidateRepository.findById(18L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(18L, CandidateStatus.REJECTED, "CV non conforme au poste");

            verify(notificationService).sendFinalRejection(any());
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

    // ────────────────────────────────────────────────────────────────────
    // submitApplication()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("submitApplication()")
    class SubmitApplicationTests {

        private ApplicationRequest makeRequest() {
            ApplicationRequest request = new ApplicationRequest();
            request.setFirstName("Alice");
            request.setLastName("Dupont");
            request.setEmail("alice@example.com");
            request.setPhone("0600000000");
            request.setAddress("Paris");
            request.setCoverLetter("Motivée !");
            request.setJobOfferId(1L);
            return request;
        }

        @Test
        @DisplayName("sauvegarde le candidat, stocke le CV et déclenche l'Agent 1 n8n")
        void shouldSaveCandidateStoreCvAndTriggerAgent1() {
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setTitle("Développeur Java");

            MockMultipartFile cvFile = new MockMultipartFile(
                    "cv", "cv.pdf", "application/pdf", "contenu du cv".getBytes());

            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(jobOffer));
            when(candidateRepository.existsByEmailAndJobOfferId("alice@example.com", 1L)).thenReturn(false);
            when(candidateRepository.save(any())).thenAnswer(inv -> {
                Candidate c = inv.getArgument(0);
                c.setId(42L);
                return c;
            });
            when(localFileStorageService.storeFile(cvFile)).thenReturn(Map.of(
                    "fileName", "cv_stored.pdf",
                    "path", "uploads/cvs/cv_stored.pdf",
                    "url", "http://localhost:8080/api/files/cv_stored.pdf",
                    "fileSize", "13"
            ));
            when(cvTextExtractionService.extractText(any(), anyString())).thenReturn("texte extrait du cv");
            when(cvRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.submitApplication(makeRequest(), cvFile);

            verify(candidateRepository).save(argThat(c ->
                    c.getEmail().equals("alice@example.com") && c.getStatus() == CandidateStatus.APPLIED));
            verify(cvRepository).save(argThat(cv -> cv.getExtractedText().equals("texte extrait du cv")));
            verify(notificationService).sendApplicationConfirmation(any());
            verify(n8nService).triggerAgent1CvParser(any());
        }

        @Test
        @DisplayName("refuse une candidature en doublon (même email + même offre)")
        void shouldRejectDuplicateApplication() {
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(jobOffer));
            when(candidateRepository.existsByEmailAndJobOfferId("alice@example.com", 1L)).thenReturn(true);

            MockMultipartFile cvFile = new MockMultipartFile(
                    "cv", "cv.pdf", "application/pdf", "contenu".getBytes());

            assertThatThrownBy(() -> candidateService.submitApplication(makeRequest(), cvFile))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("déjà postulé");

            verify(candidateRepository, never()).save(any());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // saveAiScore() — seuil AI_SCORE_THRESHOLD = 60
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("saveAiScore()")
    class SaveAiScoreTests {

        @Test
        @DisplayName("score >= 60 → statut CV_REVIEWED (Agent 2 notifie le manager)")
        void shouldSetCvReviewedWhenScoreAboveThreshold() {
            Candidate candidate = makeCandidate(20L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(20L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.saveAiScore(20L, 60, "résumé", "GOOD_MATCH");

            verify(candidateRepository, atLeastOnce()).save(argThat(c -> c.getStatus() == CandidateStatus.CV_REVIEWED));
        }

        @Test
        @DisplayName("score en zone grise (55-65) → CV_REVIEWED + needsHumanReview, jamais de rejet automatique")
        void shouldRouteGreyZoneScoreToHumanReview() {
            Candidate candidate = makeCandidate(21L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(21L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // 59 était autrefois un rejet automatique sur ce endpoint : le seuil seul
            // décidait, sans jamais consulter la bande d'incertitude.
            candidateService.saveAiScore(21L, 59, "résumé", "WEAK_MATCH");

            verify(candidateRepository, atLeastOnce()).save(argThat(c ->
                    c.getStatus() == CandidateStatus.CV_REVIEWED
                            && Boolean.TRUE.equals(c.getNeedsHumanReview())));
        }

        @Test
        @DisplayName("score franchement sous le seuil → statut AUTO_REJECTED (rejeté par l'IA)")
        void shouldSetAutoRejectedWhenScoreBelowThreshold() {
            Candidate candidate = makeCandidate(22L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(22L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.saveAiScore(22L, 40, "résumé", "WEAK_MATCH");

            verify(candidateRepository, atLeastOnce()).save(argThat(c ->
                    c.getStatus() == CandidateStatus.AUTO_REJECTED
                            && !Boolean.TRUE.equals(c.getNeedsHumanReview())));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // overrideAiScore()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("overrideAiScore()")
    class OverrideAiScoreTests {

        @Test
        @DisplayName("le score manuel prime : >= 60 → CV_REVIEWED même si le score IA original était faible")
        void shouldUseManualScoreOverAiScore() {
            Candidate candidate = makeCandidate(30L, CandidateStatus.AUTO_REJECTED);
            candidate.setAiScore(20);
            when(candidateRepository.findById(30L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.overrideAiScore(30L, 75, "CV mal parsé, profil en réalité excellent", "rh_user");

            verify(candidateRepository, atLeastOnce()).save(argThat(c -> c.getStatus() == CandidateStatus.CV_REVIEWED));
            verify(auditLogService).log(eq("CANDIDATE"), eq(30L), eq("SCORE_OVERRIDE"), any(), any());
        }

        @Test
        @DisplayName("rejette un score manuel hors bornes (0-100)")
        void shouldRejectOutOfRangeScore() {
            assertThatThrownBy(() -> candidateService.overrideAiScore(30L, 150, "motif", "rh_user"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> candidateService.overrideAiScore(30L, -1, "motif", "rh_user"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("exige une justification non vide")
        void shouldRequireNonBlankReason() {
            assertThatThrownBy(() -> candidateService.overrideAiScore(30L, 80, "", "rh_user"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("justification");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // managerDecision()
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("managerDecision()")
    class ManagerDecisionTests {

        @Test
        @DisplayName("refuse la décision si le dossier n'a pas encore été validé par le RH (garde-fou)")
        void shouldRejectDecisionWhenNotYetValidatedByHr() {
            Candidate candidate = makeCandidate(40L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(40L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.managerDecision(40L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("validé par le RH");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("rejette une décision autre que ACCEPTED/REJECTED")
        void shouldRejectInvalidDecisionValue() {
            assertThatThrownBy(() -> candidateService.managerDecision(40L, CandidateStatus.CV_REVIEWED))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Décision manager invalide");
        }

        @Test
        @DisplayName("refuse l'acceptation directe depuis CV_REVIEWED : l'entretien téléphonique RH est obligatoire")
        void shouldRejectDirectAcceptanceFromCvReviewed() {
            Candidate candidate = makeCandidate(41L, CandidateStatus.CV_REVIEWED);
            when(candidateRepository.findById(41L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.managerDecision(41L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("entretien téléphonique");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("accepte la décision une fois l'entretien téléphonique RH passé")
        void shouldAcceptDecisionAfterPhoneScreening() {
            Candidate candidate = makeCandidate(42L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(42L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.managerDecision(42L, CandidateStatus.ACCEPTED);

            verify(candidateRepository).save(argThat(c -> c.getStatus() == CandidateStatus.ACCEPTED));
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Périmètre manager (correctif sécurité) — updateCandidateStatus() /
    // managerDecision() doivent refuser qu'un manager agisse sur un
    // candidat hors de ses offres (managerEmail) / de son département.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Périmètre manager (autorisation par candidat)")
    class ManagerScopeAuthorizationTests {

        private void authenticateAs(String username, Role.ERole... roles) {
            java.util.List<org.springframework.security.core.GrantedAuthority> authorities = java.util.Arrays.stream(roles)
                    .map(r -> new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + r.name().replace("ROLE_", "")))
                    .collect(java.util.stream.Collectors.toList());
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(username, "password", authorities));
        }

        private User makeManagerUser(String username, String email, Department department) {
            User user = new User();
            user.setId(100L);
            user.setUsername(username);
            user.setEmail(email);
            Role managerRole = new Role(Role.ERole.ROLE_MANAGER);
            user.setRoles(Set.of(managerRole));
            user.setDepartment(department);
            return user;
        }

        private Candidate candidateWithOffer(Long id, String managerEmail, Department department) {
            Candidate candidate = makeCandidate(id, CandidateStatus.CV_REVIEWED);
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setManagerEmail(managerEmail);
            jobOffer.setDepartment(department);
            candidate.setJobOffer(jobOffer);
            return candidate;
        }

        private Candidate candidateWithOfferJobFamily(Long id, JobOffer.JobFamily jobFamily) {
            Candidate candidate = makeCandidate(id, CandidateStatus.CV_REVIEWED);
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setJobFamily(jobFamily);
            candidate.setJobOffer(jobOffer);
            return candidate;
        }

        @Test
        @DisplayName("un manager peut agir sur un candidat de sa propre offre (managerEmail)")
        void shouldAllowManagerOwningTheJobOfferByEmail() {
            Candidate candidate = candidateWithOffer(50L, "manager.rd@company.com", null);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", null);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(50L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(50L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager peut agir sur un candidat de son département")
        void shouldAllowManagerOwningTheJobOfferByDepartment() {
            Department rd = new Department("R&D", "R&D");
            rd.setId(1L);
            Candidate candidate = candidateWithOffer(51L, "autre.manager@company.com", rd);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", rd);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(manager));
            when(candidateRepository.findById(51L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(51L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager peut agir sur un candidat dont l'offre est résolue vers lui par la famille de métier")
        void shouldAllowManagerOwningTheJobOfferByJobFamily() {
            Candidate candidate = candidateWithOfferJobFamily(54L, JobOffer.JobFamily.CS);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            User manager = makeManagerUser("manager_cs", "manager.cs@company.com", null);
            manager.setJobFamily(JobOffer.JobFamily.CS);

            authenticateAs("manager_cs", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_cs")).thenReturn(Optional.of(manager));
            when(userRepository.findManagersByJobFamily(JobOffer.JobFamily.CS, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(manager));
            when(candidateRepository.findById(54L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(54L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager d'un autre département ne voit pas les dossiers d'un département qui a déjà ses managers, même si la famille de métier correspond")
        void shouldNotSeeDossiersOfAnotherDepartmentDespiteSameJobFamily() {
            Department rd = new Department("Recherche & Développement", "R&D");
            rd.setId(1L);
            Department qa = new Department("Quality Assurance", "QA");
            qa.setId(2L);

            Candidate candidate = candidateWithOffer(56L, "rd.lead@company.com", rd);
            candidate.getJobOffer().setJobFamily(JobOffer.JobFamily.RSD);
            User qaManager = makeManagerUser("manager_qa", "manager.qa@company.com", qa);
            qaManager.setJobFamily(JobOffer.JobFamily.RSD);

            authenticateAs("manager_qa", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_qa")).thenReturn(Optional.of(qaManager));
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(makeManagerUser("manager_rd", "manager.rd@company.com", rd)));
            when(candidateRepository.findById(56L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(56L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(AccessDeniedException.class);

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("un manager NE PEUT PAS agir sur un candidat hors de son périmètre (autre offre, autre département)")
        void shouldRejectManagerOutsideScope() {
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);
            Department rd = new Department("R&D", "R&D");
            rd.setId(1L);

            Candidate candidate = candidateWithOffer(52L, "manager.devops@company.com", devops);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", rd);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(52L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(52L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(AccessDeniedException.class);

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("managerDecision() hérite aussi de la vérification de périmètre")
        void managerDecisionShouldAlsoEnforceScope() {
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);
            Department rd = new Department("R&D", "R&D");
            rd.setId(1L);

            Candidate candidate = candidateWithOffer(53L, "manager.devops@company.com", devops);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", rd);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(53L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.managerDecision(53L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("RH/Admin ne sont jamais restreints, même hors du périmètre d'un manager")
        void shouldNeverRestrictHrOrAdmin() {
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);
            Candidate candidate = candidateWithOffer(54L, "manager.devops@company.com", devops);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);

            User hrUser = new User();
            hrUser.setId(200L);
            hrUser.setUsername("rh_user");
            hrUser.setEmail("rh@company.com");
            hrUser.setRoles(Set.of(new Role(Role.ERole.ROLE_HR)));

            authenticateAs("rh_user", Role.ERole.ROLE_HR);
            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(hrUser));
            when(candidateRepository.findById(54L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(54L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un appel anonyme (n8n) n'est jamais restreint")
        void shouldNeverRestrictAnonymousCalls() {
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);
            Candidate candidate = candidateWithOffer(55L, "manager.devops@company.com", devops);

            // Pas d'authentification définie dans le SecurityContext (cas n8n / appel système)
            when(candidateRepository.findById(55L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(55L, CandidateStatus.CV_REVIEWED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("getCandidatesByStatus() ne renvoie à un manager que les candidats de son périmètre")
        void shouldScopeGetCandidatesByStatusToCurrentManager() {
            Department rd = new Department("R&D", "R&D");
            rd.setId(1L);
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);

            Candidate inScope = candidateWithOffer(60L, "manager.rd@company.com", rd);
            Candidate outOfScope = candidateWithOffer(61L, "manager.devops@company.com", devops);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", rd);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findByStatus(CandidateStatus.CV_REVIEWED))
                    .thenReturn(List.of(inScope, outOfScope));

            List<CandidateResponse> result = candidateService.getCandidatesByStatus(CandidateStatus.CV_REVIEWED);

            assertThat(result).extracting("id").containsExactly(60L);
        }

        @Test
        @DisplayName("getCandidateById() refuse à un manager hors périmètre l'accès à un candidat")
        void shouldDenyGetCandidateByIdOutsideManagerScope() {
            Department devops = new Department("4YOU", "4YOU");
            devops.setId(2L);
            Candidate candidate = candidateWithOffer(62L, "manager.devops@company.com", devops);
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", null);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(62L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.getCandidateById(62L))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Double niveau de décision : le manager émet un avis (ACCEPTED /
    // MANAGER_REJECTED), le RH seul contre-signe la décision finale
    // (HIRED / REJECTED) et déclenche l'e-mail au candidat.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Avis manager → validation finale RH")
    class TwoLevelDecisionTests {

        private static final Long MANAGER_ID = 100L;

        private void authenticateAs(String username, Role.ERole... roles) {
            List<org.springframework.security.core.GrantedAuthority> authorities = java.util.Arrays.stream(roles)
                    .map(r -> new org.springframework.security.core.authority.SimpleGrantedAuthority(
                            "ROLE_" + r.name().replace("ROLE_", "")))
                    .collect(java.util.stream.Collectors.toList());
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(username, "password", authorities));
        }

        private User makeUser(Long id, String username, String email, Role.ERole role) {
            User user = new User();
            user.setId(id);
            user.setUsername(username);
            user.setEmail(email);
            user.setRoles(Set.of(new Role(role)));
            return user;
        }

        private User managerInScope() {
            return makeUser(MANAGER_ID, "manager_cs", "manager.cs@company.com", Role.ERole.ROLE_MANAGER);
        }

        private User hrUser() {
            return makeUser(200L, "rh_user", "rh@company.com", Role.ERole.ROLE_HR);
        }

        /** Dossier rattaché à une offre dont le manager « cs » est le destinataire naturel. */
        private Candidate candidateOwnedByManager(Long id, CandidateStatus status) {
            Candidate candidate = makeCandidate(id, status);
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setTitle("Développeur Java");
            jobOffer.setManagerEmail("manager.cs@company.com");
            candidate.setJobOffer(jobOffer);
            return candidate;
        }

        private void givenManager() {
            authenticateAs("manager_cs", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_cs")).thenReturn(Optional.of(managerInScope()));
        }

        private void givenHr() {
            authenticateAs("rh_user", Role.ERole.ROLE_HR);
            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(hrUser()));
        }

        // ── Garde-fous du point d'entrée générique de statut ─────────────

        @Test
        @DisplayName("un manager ne peut pas écrire HIRED via le changement de statut générique")
        void managerCannotWriteHiredOnGenericStatusEndpoint() {
            Candidate candidate = candidateOwnedByManager(70L, CandidateStatus.ACCEPTED);
            givenManager();
            when(candidateRepository.findById(70L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(70L, CandidateStatus.HIRED))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("validation finale");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("un manager ne peut écrire que son avis : PHONE_SCREENING lui est refusé")
        void managerCannotDriveThePipeline() {
            Candidate candidate = candidateOwnedByManager(71L, CandidateStatus.CV_REVIEWED);
            givenManager();
            when(candidateRepository.findById(71L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(71L, CandidateStatus.PHONE_SCREENING))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("Un manager ne peut enregistrer que son avis");

            verify(candidateRepository, never()).save(any());
        }

        // ── Avis manager : notification RH, aucune notification candidat ─

        @Test
        @DisplayName("un avis favorable notifie le RH et pas le candidat")
        void favourableAvisNotifiesHrOnly() {
            Candidate candidate = candidateOwnedByManager(72L, CandidateStatus.PHONE_SCREENING);
            givenManager();
            when(candidateRepository.findById(72L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.findByRoleName(Role.ERole.ROLE_HR)).thenReturn(List.of(hrUser()));

            candidateService.updateCandidateStatus(72L, CandidateStatus.ACCEPTED);

            verify(notificationService).sendManagerDecisionToHr(
                    argThat(c -> c.getStatus() == CandidateStatus.ACCEPTED),
                    eq(CandidateStatus.ACCEPTED), any(User.class), eq(List.of("rh@company.com")));
            verify(n8nService, never()).triggerAgent3FinalDecision(
                    any(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("un refus proposé par le manager devient MANAGER_REJECTED et notifie le RH")
        void managerRefusalBecomesProposition() {
            Candidate candidate = candidateOwnedByManager(73L, CandidateStatus.TECHNICAL_TEST);
            givenManager();
            when(candidateRepository.findById(73L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.findByRoleName(Role.ERole.ROLE_HR)).thenReturn(List.of(hrUser()));

            candidateService.updateCandidateStatus(73L, CandidateStatus.REJECTED, "Expérience insuffisante");

            verify(candidateRepository).save(argThat(c -> c.getStatus() == CandidateStatus.MANAGER_REJECTED));
            verify(notificationService).sendManagerDecisionToHr(
                    any(), eq(CandidateStatus.MANAGER_REJECTED), any(User.class), eq(List.of("rh@company.com")));
            verify(n8nService, never()).triggerAgent3FinalDecision(
                    any(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("le refus d'un manager exige un motif")
        void managerRefusalRequiresReason() {
            Candidate candidate = candidateOwnedByManager(74L, CandidateStatus.TECHNICAL_TEST);
            givenManager();
            when(candidateRepository.findById(74L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(74L, CandidateStatus.REJECTED, " "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("motif");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("le RH qui refuse directement sans avis manager acte un refus final et notifie le candidat")
        void hrDirectRefusalIsFinal() {
            Candidate candidate = candidateOwnedByManager(75L, CandidateStatus.CV_REVIEWED);
            givenHr();
            when(candidateRepository.findById(75L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(75L, CandidateStatus.REJECTED, "Profil non conforme au poste");

            verify(candidateRepository).save(argThat(c -> c.getStatus() == CandidateStatus.REJECTED));
            verify(notificationService).sendFinalRejection(any(Candidate.class));
            verify(notificationService, never()).sendManagerDecisionToHr(any(), any(), any(), any());
        }

        // ── hrFinalValidation() ─────────────────────────────────────────

        @Test
        @DisplayName("un manager ne peut pas valider lui-même la décision finale")
        void managerCannotCounterSignHisOwnAvis() {
            Candidate candidate = candidateOwnedByManager(76L, CandidateStatus.ACCEPTED);
            givenManager();
            when(candidateRepository.findById(76L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.hrFinalValidation(
                    76L, CandidateStatus.HIRED, LocalDateTime.now().plusDays(7), null))
                    .isInstanceOf(AccessDeniedException.class);

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("HIRED exige la date de présentation des documents")
        void hiringRequiresPresentationDate() {
            Candidate candidate = candidateOwnedByManager(77L, CandidateStatus.ACCEPTED);
            givenHr();
            when(candidateRepository.findById(77L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.hrFinalValidation(77L, CandidateStatus.HIRED, null, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("date de présentation");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("impossible de valider une embauche sur un avis de refus")
        void cannotHireOnRejectionAvis() {
            Candidate candidate = candidateOwnedByManager(78L, CandidateStatus.MANAGER_REJECTED);
            givenHr();
            when(candidateRepository.findById(78L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.hrFinalValidation(
                    78L, CandidateStatus.HIRED, LocalDateTime.now().plusDays(7), null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("proposé un refus");
        }

        @Test
        @DisplayName("un refus final exige un motif")
        void finalRefusalRequiresReason() {
            Candidate candidate = candidateOwnedByManager(79L, CandidateStatus.ACCEPTED);
            givenHr();
            when(candidateRepository.findById(79L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.hrFinalValidation(
                    79L, CandidateStatus.REJECTED, null, "   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("motif");
        }

        @Test
        @DisplayName("refuse la validation finale d'un dossier sans avis manager en attente")
        void refusesValidationWithoutPendingAvis() {
            Candidate candidate = candidateOwnedByManager(80L, CandidateStatus.TECHNICAL_TEST);
            givenHr();
            when(candidateRepository.findById(80L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.hrFinalValidation(
                    80L, CandidateStatus.HIRED, LocalDateTime.now().plusDays(7), null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Aucun avis de manager");
        }

        @Test
        @DisplayName("validation d'un avis favorable : HIRED + date + convocation")
        void hiresAndSendsConvocation() {
            Candidate candidate = candidateOwnedByManager(81L, CandidateStatus.ACCEPTED);
            LocalDateTime presentation = LocalDateTime.now().plusDays(10).withNano(0);
            givenHr();
            when(candidateRepository.findById(81L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CandidateResponse response = candidateService.hrFinalValidation(
                    81L, CandidateStatus.HIRED, presentation, null);

            assertThat(response.getStatus()).isEqualTo(CandidateStatus.HIRED);
            verify(candidateRepository).save(argThat(c ->
                    c.getStatus() == CandidateStatus.HIRED && presentation.equals(c.getPresentationDate())));
            verify(notificationService).sendHiringConvocation(any(Candidate.class));
            verify(auditLogService).log(eq("CANDIDATE"), eq(81L), eq("FINAL_VALIDATION"),
                    eq(CandidateStatus.ACCEPTED), eq(CandidateStatus.HIRED));
        }

        @Test
        @DisplayName("validation d'un refus proposé : REJECTED + motif + e-mail candidat")
        void confirmsRefusalAndNotifiesCandidate() {
            Candidate candidate = candidateOwnedByManager(82L, CandidateStatus.MANAGER_REJECTED);
            givenHr();
            when(candidateRepository.findById(82L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.hrFinalValidation(82L, CandidateStatus.REJECTED, null, "Poste pourvu en interne");

            verify(candidateRepository).save(argThat(c ->
                    c.getStatus() == CandidateStatus.REJECTED
                            && "Poste pourvu en interne".equals(c.getStatusReason())));
            verify(notificationService).sendFinalRejection(any(Candidate.class));
            verify(notificationService, never()).sendHiringConvocation(any());
        }
    }
}
