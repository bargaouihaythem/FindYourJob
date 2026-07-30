package com.recrutement.app.service;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

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
    @Mock ManagerRoutingService managerRoutingService;

    @InjectMocks
    CandidateService candidateService;

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

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager(null);

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

            candidateService.getValidatedCandidatesForManager(null);

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

            List<CandidateResponse> result = candidateService.getValidatedCandidatesForManager(null);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("un manager (non privilégié) interroge le repository scopé avec sa famille de métier")
        void shouldQueryScopedRepositoryWithJobFamilyForManager() {
            User manager = new User();
            manager.setUsername("manager_cs");
            manager.setEmail("manager.cs@company.com");
            manager.setJobFamily(JobOffer.JobFamily.CS);
            Role managerRole = new Role(Role.ERole.ROLE_MANAGER);
            manager.setRoles(Set.of(managerRole));

            when(userRepository.findByUsername("manager_cs")).thenReturn(Optional.of(manager));
            when(candidateRepository.findByStatusInAndJobOfferManagerEmailOrDepartment(
                    anyList(), eq("manager.cs@company.com"), isNull(), eq(JobOffer.JobFamily.CS)))
                    .thenReturn(List.of());

            candidateService.getValidatedCandidatesForManager("manager_cs");

            verify(candidateRepository).findByStatusInAndJobOfferManagerEmailOrDepartment(
                    anyList(), eq("manager.cs@company.com"), isNull(), eq(JobOffer.JobFamily.CS));
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
            // cvUrl (6e argument) est null ici : le candidat de test n'a pas de CV attaché
            verify(n8nService).triggerAgent3HrValidation(eq(10L), anyString(), anyString(), anyString(), anyString(),
                    nullable(String.class), anyString(), any(), any());
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
        @DisplayName("score < 60 → statut AUTO_REJECTED (rejeté par l'IA)")
        void shouldSetAutoRejectedWhenScoreBelowThreshold() {
            Candidate candidate = makeCandidate(21L, CandidateStatus.APPLIED);
            when(candidateRepository.findById(21L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.saveAiScore(21L, 59, "résumé", "WEAK_MATCH");

            verify(candidateRepository, atLeastOnce()).save(argThat(c -> c.getStatus() == CandidateStatus.AUTO_REJECTED));
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
        @DisplayName("accepte la décision quand le dossier a déjà été validé par le RH")
        void shouldAcceptDecisionWhenAlreadyValidated() {
            Candidate candidate = makeCandidate(41L, CandidateStatus.CV_REVIEWED);
            when(candidateRepository.findById(41L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.managerDecision(41L, CandidateStatus.ACCEPTED);

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
            User manager = makeManagerUser("manager_rd", "manager.rd@company.com", rd);

            authenticateAs("manager_rd", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_rd")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(51L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(51L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager peut agir sur un candidat via sa famille de métier assignée (routage automatique)")
        void shouldAllowManagerOwningTheJobOfferByJobFamily() {
            Candidate candidate = candidateWithOfferJobFamily(54L, JobOffer.JobFamily.CS);
            User manager = makeManagerUser("manager_cs", "manager.cs@company.com", null);
            manager.setJobFamily(JobOffer.JobFamily.CS);

            authenticateAs("manager_cs", Role.ERole.ROLE_MANAGER);
            when(userRepository.findByUsername("manager_cs")).thenReturn(Optional.of(manager));
            when(candidateRepository.findById(54L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(54L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
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
    }
}
