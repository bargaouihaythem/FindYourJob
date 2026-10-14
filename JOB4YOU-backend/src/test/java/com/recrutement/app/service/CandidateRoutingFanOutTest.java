package com.recrutement.app.service;

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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Matrice multi-managers / multi-candidats du routage RH → manager.
 *
 * Un département de deux managers, trois dossiers à transmettre : chaque manager doit
 * recevoir chaque dossier (6 transmissions distinctes, pas une seule), et la destination
 * doit rester figée sur le dossier même si l'organisation bouge ensuite.
 *
 * La chaîne d'aiguillage (ManagerRoutingService + ManagerScopeService) est réelle ;
 * seuls les repositories et les envois n8n sont simulés.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Routage RH → manager - matrice multi-managers / multi-candidats")
class CandidateRoutingFanOutTest {

    @Mock CandidateRepository candidateRepository;
    @Mock JobOfferRepository jobOfferRepository;
    @Mock CVRepository cvRepository;
    @Mock LocalFileStorageService localFileStorageService;
    @Mock NotificationService notificationService;
    @Mock N8nService n8nService;
    @Mock AuditLogService auditLogService;
    @Mock CvTextExtractionService cvTextExtractionService;
    @Mock AccessControlService accessControlService;
    @Mock UserRepository userRepository;

    @Spy ManagerRoutingService managerRoutingService = new ManagerRoutingService();
    @Spy ManagerScopeService managerScopeService = new ManagerScopeService();

    @InjectMocks
    CandidateService candidateService;

    private static final Department CONSULTING = department(1L, "Consulting Services", "CS");

    private static Department department(Long id, String name, String code) {
        Department department = new Department(name, code);
        department.setId(id);
        return department;
    }

    private User manager(Long id, String username, String email, String firstName, String lastName,
                         Department department) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setRoles(Set.of(new Role(Role.ERole.ROLE_MANAGER)));
        user.setDepartment(department);
        return user;
    }

    private User manager(Long id, String username, String email, Department department) {
        return manager(id, username, email, username, "Nommé", department);
    }

    private final User managerA = manager(11L, "manager_a", "manager.a@company.com", "Alice", "Blanc", CONSULTING);
    private final User managerB = manager(12L, "manager_b", "manager.b@company.com", "Bruno", "Noir", CONSULTING);

    private JobOffer consultingOffer() {
        JobOffer jobOffer = new JobOffer();
        jobOffer.setId(1L);
        jobOffer.setTitle("Consultant Fonctionnel");
        jobOffer.setDepartment(CONSULTING);
        jobOffer.setJobFamily(JobOffer.JobFamily.CS);
        return jobOffer;
    }

    private Candidate dossier(Long id, CandidateStatus status) {
        Candidate candidate = new Candidate();
        candidate.setId(id);
        candidate.setFirstName("Candidat");
        candidate.setLastName(String.valueOf(id));
        candidate.setEmail("candidat." + id + "@example.com");
        candidate.setStatus(status);
        candidate.setJobOffer(consultingOffer());
        candidate.setApplicationDate(LocalDateTime.now());
        candidate.setLastUpdated(LocalDateTime.now());
        return candidate;
    }

    @BeforeEach
    void wireChain() {
        ReflectionTestUtils.setField(managerRoutingService, "userRepository", userRepository);
        ReflectionTestUtils.setField(managerScopeService, "managerRoutingService", managerRoutingService);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(User user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                user.getUsername(), "password",
                user.getRoles().stream()
                        .map(role -> new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                role.getName().name()))
                        .collect(Collectors.toList())));
        when(userRepository.findByUsername(user.getUsername())).thenReturn(Optional.of(user));
    }

    /** Les deux managers du département sont bien résolus par la chaîne structurelle. */
    private void givenTwoManagersInDepartment() {
        when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                .thenReturn(List.of(managerA, managerB));
    }

    @Nested
    @DisplayName("2 managers × 3 dossiers")
    class TwoManagersThreeDossiers {

        @Test
        @DisplayName("chaque manager reçoit chaque dossier : 6 transmissions distinctes")
        void everyManagerReceivesEveryDossier() {
            givenTwoManagersInDepartment();
            List<Candidate> dossiers = List.of(
                    dossier(101L, CandidateStatus.PHONE_SCREENING),
                    dossier(102L, CandidateStatus.PHONE_SCREENING),
                    dossier(103L, CandidateStatus.PHONE_SCREENING));
            dossiers.forEach(d -> {
                when(candidateRepository.findById(d.getId())).thenReturn(Optional.of(d));
                when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            });

            dossiers.forEach(d -> candidateService.updateCandidateStatus(
                    d.getId(), CandidateStatus.TECHNICAL_TEST));

            ArgumentCaptor<Long> candidateIds = ArgumentCaptor.forClass(Long.class);
            ArgumentCaptor<String> managerEmails = ArgumentCaptor.forClass(String.class);
            verify(n8nService, times(6)).triggerAgent3HrValidation(
                    candidateIds.capture(), anyString(), anyString(), anyString(), anyString(),
                    any(), anyString(), managerEmails.capture(), anyString());

            // Chaque couple (dossier, manager) est transmis exactement une fois.
            List<String> pairs = new java.util.ArrayList<>();
            for (int i = 0; i < candidateIds.getAllValues().size(); i++) {
                pairs.add(candidateIds.getAllValues().get(i) + "/" + managerEmails.getAllValues().get(i));
            }
            assertThat(pairs).containsExactlyInAnyOrder(
                    "101/manager.a@company.com", "101/manager.b@company.com",
                    "102/manager.a@company.com", "102/manager.b@company.com",
                    "103/manager.a@company.com", "103/manager.b@company.com");
        }

        @Test
        @DisplayName("la destination est gelée sur chaque dossier, avec les deux destinataires")
        void routingIsFrozenOnEachDossier() {
            givenTwoManagersInDepartment();
            when(userRepository.findById(11L)).thenReturn(Optional.of(managerA));
            Candidate candidate = dossier(104L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(104L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            candidateService.updateCandidateStatus(104L, CandidateStatus.TECHNICAL_TEST);

            assertThat(candidate.getRoutedManagerEmails())
                    .isEqualTo("manager.a@company.com,manager.b@company.com");
            assertThat(candidate.getRoutingBasis()).isEqualTo(RoutingBasis.DEPARTMENT);
            assertThat(candidate.getRoutedAt()).isNotNull();
            assertThat(candidate.getRoutedToManager()).isNotNull();
            assertThat(candidate.getRoutedToManager().getId()).isEqualTo(11L);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Le gel de la destination : l'organisation peut bouger, le dossier reste
    // chez le manager qui l'a reçu.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Visibilité après transmission")
    class VisibilityAfterRouting {

        @Test
        @DisplayName("le destinataire gelé garde l'accès même si l'offre change de département")
        void frozenRecipientKeepsAccess() {
            Candidate candidate = dossier(110L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.a@company.com,manager.b@company.com");
            candidate.setRoutingBasis(RoutingBasis.DEPARTMENT);
            candidate.setRoutedAt(LocalDateTime.now());
            // L'offre est depuis partie ailleurs, sans eux :
            candidate.getJobOffer().setDepartment(department(2L, "Quality Assurance", "QA"));
            candidate.setStatus(CandidateStatus.TECHNICAL_TEST);

            authenticate(managerA);
            when(candidateRepository.findById(110L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(110L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager du nouveau département ne voit pas un dossier déjà transmis ailleurs")
        void newDepartmentManagerDoesNotSeeRoutedDossier() {
            Candidate candidate = dossier(111L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.a@company.com,manager.b@company.com");
            candidate.setRoutingBasis(RoutingBasis.DEPARTMENT);
            User latecomer = manager(13L, "manager_qa", "manager.qa@company.com",
                    department(2L, "Quality Assurance", "QA"));
            candidate.getJobOffer().setDepartment(latecomer.getDepartment());

            authenticate(latecomer);
            when(candidateRepository.findById(111L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(111L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(AccessDeniedException.class);

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("un manager hors destinataires est absent de la vue « dossiers validés »")
        void outOfScopeManagerGetsNoDossiers() {
            Candidate routed = dossier(112L, CandidateStatus.TECHNICAL_TEST);
            routed.setRoutedManagerEmails("manager.a@company.com");
            routed.setRoutingBasis(RoutingBasis.DEPARTMENT);
            User outsider = manager(14L, "manager_other", "manager.other@company.com",
                    department(3L, "DevOps", "DEVOPS"));

            authenticate(outsider);
            when(candidateRepository.findByStatusIn(any())).thenReturn(List.of(routed));

            assertThat(candidateService.getValidatedCandidatesForManager("manager_other")).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Ré-exécution : renvoyer le dossier ne doit pas le faire partir ailleurs
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Ré-notification idempotente")
    class ReNotification {

        @Test
        @DisplayName("un second passage en TECHNICAL_TEST renvoie aux mêmes destinataires")
        void secondPassKeepsSameRecipients() {
            givenTwoManagersInDepartment();
            Candidate candidate = dossier(120L, CandidateStatus.TECHNICAL_TEST);
            when(candidateRepository.findById(120L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // premier passage
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            candidateService.updateCandidateStatus(120L, CandidateStatus.TECHNICAL_TEST);
            // second passage (bouton cliqué deux fois)
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            candidateService.updateCandidateStatus(120L, CandidateStatus.TECHNICAL_TEST);

            verify(n8nService, times(4)).triggerAgent3HrValidation(
                    eq(120L), anyString(), anyString(), anyString(), anyString(),
                    any(), anyString(), anyString(), anyString());
            assertThat(candidate.getRoutedManagerEmails())
                    .isEqualTo("manager.a@company.com,manager.b@company.com");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Aperçu demandé par le RH avant de confirmer
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("routingPreview() - avant confirmation RH")
    class RoutingPreviewTests {

        @Test
        @DisplayName("avant transmission, l'aperçu annonce les deux managers du département")
        void previewAnnouncesDepartmentManagersBeforeRouting() {
            givenTwoManagersInDepartment();
            Candidate candidate = dossier(130L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(130L)).thenReturn(Optional.of(candidate));

            ManagerRoutingService.RoutingResult preview = candidateService.routingPreview(130L);

            assertThat(preview.isResolved()).isTrue();
            assertThat(preview.emails())
                    .containsExactly("manager.a@company.com", "manager.b@company.com");
            assertThat(preview.basis()).isEqualTo(RoutingBasis.DEPARTMENT);
            assertThat(preview.managers()).extracting("fullName")
                    .containsExactly("Alice Blanc", "Bruno Noir");
            // Aperçu = lecture seule : rien n'est envoyé, rien n'est gelé.
            verifyNoNotifications();
            assertThat(candidate.getRoutedAt()).isNull();
        }

        @Test
        @DisplayName("après transmission, l'aperçu montre la destination gelée, pas une nouvelle résolution")
        void previewShowsFrozenDestinationAfterRouting() {
            Candidate candidate = dossier(131L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.a@company.com");
            candidate.setRoutingBasis(RoutingBasis.OFFER_MANAGER);
            when(candidateRepository.findById(131L)).thenReturn(Optional.of(candidate));

            ManagerRoutingService.RoutingResult preview = candidateService.routingPreview(131L);

            assertThat(preview.emails()).containsExactly("manager.a@company.com");
            assertThat(preview.basis()).isEqualTo(RoutingBasis.OFFER_MANAGER);
        }

        private void verifyNoNotifications() {
            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
        }
    }
}
