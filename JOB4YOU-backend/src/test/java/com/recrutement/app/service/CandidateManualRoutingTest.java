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
 * Désignation humaine du manager destinataire à la transmission RH → manager.
 *
 * Depuis l'exigence « l'humain doit intervenir pour tous les scénarios », la chaîne
 * structurelle (manager de l'offre, département, famille métier, e-mail libre) ne produit
 * plus qu'une PROPOSITION : c'est le manager que le RH choisit dans la modale de
 * transmission qui reçoit le dossier, et lui seul. Un dossier sans destinataire désigné
 * ne part pas.
 *
 * La chaîne d'aiguillage (ManagerRoutingService + ManagerScopeService) est réelle ;
 * seuls les repositories et les envois n8n sont simulés.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Transmission RH → manager - le RH désigne le destinataire")
class CandidateManualRoutingTest {

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

    private void givenStorableDossier(Candidate candidate) {
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Nested
    @DisplayName("Le choix du RH fait foi")
    class DesignationMakesFaith {

        @Test
        @DisplayName("le manager désigné reçoit le dossier, seul, et la destination est gelée")
        void designatedManagerReceivesTheDossier() {
            givenTwoManagersInDepartment();
            when(userRepository.findById(12L)).thenReturn(Optional.of(managerB));
            Candidate candidate = dossier(101L, CandidateStatus.PHONE_SCREENING);
            givenStorableDossier(candidate);

            candidateService.updateCandidateStatus(101L, CandidateStatus.TECHNICAL_TEST, null, 12L);

            ArgumentCaptor<String> emails = ArgumentCaptor.forClass(String.class);
            verify(n8nService, times(1)).triggerAgent3HrValidation(
                    eq(101L), anyString(), anyString(), anyString(), anyString(),
                    any(), anyString(), emails.capture(), anyString());
            assertThat(emails.getValue()).isEqualTo("manager.b@company.com");

            assertThat(candidate.getRoutedManagerEmails()).isEqualTo("manager.b@company.com");
            assertThat(candidate.getRoutingBasis()).isEqualTo(RoutingBasis.MANUAL);
            assertThat(candidate.getRoutedAt()).isNotNull();
            assertThat(candidate.getRoutedToManager().getId()).isEqualTo(12L);
            // Le gel est tracé avec le critère, pas seulement avec le destinataire.
            verify(auditLogService).log(eq("CANDIDATE"), eq(101L), eq("ROUTING"), any(),
                    org.mockito.ArgumentMatchers.contains("la désignation manuelle du RH"));
        }

        @Test
        @DisplayName("sans destinataire désigné, la transmission est bloquée : rien n'est envoyé, rien n'est gelé")
        void transmissionWithoutDesignationIsRefused() {
            Candidate candidate = dossier(102L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(102L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(
                    102L, CandidateStatus.TECHNICAL_TEST))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("doit être désigné");

            assertThat(candidate.getStatus()).isEqualTo(CandidateStatus.PHONE_SCREENING);
            assertThat(candidate.getRoutedAt()).isNull();
            verify(candidateRepository, never()).save(any());
            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
            verify(notificationService, never()).sendPhoneScreeningValidatedNotification(any());
        }

        @Test
        @DisplayName("deux dossiers, deux destinataires : le choix porte sur le dossier, pas sur l'offre")
        void designationIsPerDossier() {
            givenTwoManagersInDepartment();
            when(userRepository.findById(11L)).thenReturn(Optional.of(managerA));
            when(userRepository.findById(12L)).thenReturn(Optional.of(managerB));
            Candidate first = dossier(103L, CandidateStatus.PHONE_SCREENING);
            Candidate second = dossier(104L, CandidateStatus.PHONE_SCREENING);
            givenStorableDossier(first);
            givenStorableDossier(second);

            candidateService.updateCandidateStatus(103L, CandidateStatus.TECHNICAL_TEST, null, 11L);
            candidateService.updateCandidateStatus(104L, CandidateStatus.TECHNICAL_TEST, null, 12L);

            assertThat(first.getRoutedManagerEmails()).isEqualTo("manager.a@company.com");
            assertThat(second.getRoutedManagerEmails()).isEqualTo("manager.b@company.com");
        }

        @Test
        @DisplayName("un second passage en TECHNICAL_TEST renvoie au même destinataire désigné")
        void secondPassKeepsSameRecipient() {
            givenTwoManagersInDepartment();
            when(userRepository.findById(12L)).thenReturn(Optional.of(managerB));
            Candidate candidate = dossier(105L, CandidateStatus.TECHNICAL_TEST);
            givenStorableDossier(candidate);

            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            candidateService.updateCandidateStatus(105L, CandidateStatus.TECHNICAL_TEST, null, 12L);
            candidate.setStatus(CandidateStatus.PHONE_SCREENING);
            candidateService.updateCandidateStatus(105L, CandidateStatus.TECHNICAL_TEST, null, 12L);

            verify(n8nService, times(2)).triggerAgent3HrValidation(
                    eq(105L), anyString(), anyString(), anyString(), anyString(),
                    any(), anyString(), eq("manager.b@company.com"), anyString());
            assertThat(candidate.getRoutedManagerEmails()).isEqualTo("manager.b@company.com");
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Le compte désigné doit être un manager joignable : un dossier ne part pas
    // vers une adresse qui n'en est pas une, ni vers un compte qui ne peut pas
    // rendre d'avis.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Le compte désigné doit être un manager joignable")
    class DesignationIsValidated {

        @Test
        @DisplayName("un compte sans rôle MANAGER est refusé")
        void nonManagerIsRefused() {
            User hr = new User();
            hr.setId(21L);
            hr.setUsername("rh");
            hr.setEmail("rh@company.com");
            hr.setRoles(Set.of(new Role(Role.ERole.ROLE_HR)));
            when(userRepository.findById(21L)).thenReturn(Optional.of(hr));
            Candidate candidate = dossier(106L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(106L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(
                    106L, CandidateStatus.TECHNICAL_TEST, null, 21L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("rôle MANAGER");

            assertThat(candidate.getRoutedAt()).isNull();
            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
        }

        @Test
        @DisplayName("un manager sans adresse e-mail est refusé")
        void managerWithoutEmailIsRefused() {
            User mute = manager(22L, "manager_sans_mail", null, CONSULTING);
            when(userRepository.findById(22L)).thenReturn(Optional.of(mute));
            Candidate candidate = dossier(107L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(107L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(
                    107L, CandidateStatus.TECHNICAL_TEST, null, 22L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pas d'adresse e-mail");

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("un destinataire inconnu bloque la transmission")
        void unknownRecipientIsRefused() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            Candidate candidate = dossier(108L, CandidateStatus.PHONE_SCREENING);
            when(candidateRepository.findById(108L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(
                    108L, CandidateStatus.TECHNICAL_TEST, null, 99L))
                    .isInstanceOf(com.recrutement.app.exception.ResourceNotFoundException.class);

            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // L'écart entre le choix du RH et la proposition automatique est tracé :
    // le département d'une offre est mal rattaché plus souvent qu'on ne le croit.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Écart à la proposition automatique")
    class DeviationFromProposal {

        @Test
        @DisplayName("choisir hors proposition journalise l'écart avec ce que proposait la chaîne")
        void outOfProposalChoiceIsAudited() {
            User devops = manager(13L, "manager_devops", "manager.devops@company.com",
                    department(2L, "DevOps", "DEVOPS"));
            givenTwoManagersInDepartment();
            when(userRepository.findById(13L)).thenReturn(Optional.of(devops));
            Candidate candidate = dossier(109L, CandidateStatus.PHONE_SCREENING);
            givenStorableDossier(candidate);

            candidateService.updateCandidateStatus(109L, CandidateStatus.TECHNICAL_TEST, null, 13L);

            verify(auditLogService).log(eq("CANDIDATE"), eq(109L), eq("ROUTING_MANUAL"),
                    eq("manager.a@company.com, manager.b@company.com"),
                    eq("Désignation manuelle par le RH : manager.devops@company.com"));
            assertThat(candidate.getRoutedManagerEmails()).isEqualTo("manager.devops@company.com");
        }

        @Test
        @DisplayName("choisir dans la proposition ne produit pas d'écart à justifier")
        void proposalChoiceIsNotADeviation() {
            givenTwoManagersInDepartment();
            when(userRepository.findById(11L)).thenReturn(Optional.of(managerA));
            Candidate candidate = dossier(110L, CandidateStatus.PHONE_SCREENING);
            givenStorableDossier(candidate);

            candidateService.updateCandidateStatus(110L, CandidateStatus.TECHNICAL_TEST, null, 11L);

            verify(auditLogService, never()).log(any(), any(), eq("ROUTING_MANUAL"), any(), any());
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
            Candidate candidate = dossier(120L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.a@company.com,manager.b@company.com");
            candidate.setRoutingBasis(RoutingBasis.DEPARTMENT);
            candidate.setRoutedAt(LocalDateTime.now());
            // L'offre est depuis partie ailleurs, sans eux :
            candidate.getJobOffer().setDepartment(department(2L, "Quality Assurance", "QA"));
            candidate.setStatus(CandidateStatus.TECHNICAL_TEST);

            authenticate(managerA);
            when(candidateRepository.findById(120L)).thenReturn(Optional.of(candidate));
            when(candidateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatCode(() -> candidateService.updateCandidateStatus(120L, CandidateStatus.ACCEPTED))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("un manager du nouveau département ne voit pas un dossier déjà transmis ailleurs")
        void newDepartmentManagerDoesNotSeeRoutedDossier() {
            Candidate candidate = dossier(121L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.a@company.com,manager.b@company.com");
            candidate.setRoutingBasis(RoutingBasis.DEPARTMENT);
            User latecomer = manager(13L, "manager_qa", "manager.qa@company.com",
                    department(2L, "Quality Assurance", "QA"));
            candidate.getJobOffer().setDepartment(latecomer.getDepartment());

            authenticate(latecomer);
            when(candidateRepository.findById(121L)).thenReturn(Optional.of(candidate));

            assertThatThrownBy(() -> candidateService.updateCandidateStatus(121L, CandidateStatus.ACCEPTED))
                    .isInstanceOf(AccessDeniedException.class);

            verify(candidateRepository, never()).save(any());
        }

        @Test
        @DisplayName("un manager hors destinataires est absent de la vue « dossiers validés »")
        void outOfScopeManagerGetsNoDossiers() {
            Candidate routed = dossier(122L, CandidateStatus.TECHNICAL_TEST);
            routed.setRoutedManagerEmails("manager.a@company.com");
            routed.setRoutingBasis(RoutingBasis.MANUAL);
            User outsider = manager(14L, "manager_other", "manager.other@company.com",
                    department(3L, "DevOps", "DEVOPS"));

            authenticate(outsider);
            when(candidateRepository.findByStatusIn(any())).thenReturn(List.of(routed));

            assertThat(candidateService.getValidatedCandidatesForManager("manager_other")).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // La proposition affichée dans la modale reste la chaîne structurelle :
    // c'est elle que le RH confirme ou corrige, jamais l'inverse.
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("routingPreview() - la proposition de la modale")
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
            verify(n8nService, never()).triggerAgent3HrValidation(any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
            assertThat(candidate.getRoutedAt()).isNull();
        }

        @Test
        @DisplayName("après transmission, l'aperçu montre le destinataire gelé, pas une nouvelle résolution")
        void previewShowsFrozenDestinationAfterRouting() {
            Candidate candidate = dossier(131L, CandidateStatus.TECHNICAL_TEST);
            candidate.setRoutedManagerEmails("manager.b@company.com");
            candidate.setRoutingBasis(RoutingBasis.MANUAL);
            when(candidateRepository.findById(131L)).thenReturn(Optional.of(candidate));
            when(userRepository.findByEmail("manager.b@company.com")).thenReturn(Optional.of(managerB));

            ManagerRoutingService.RoutingResult preview = candidateService.routingPreview(131L);

            assertThat(preview.emails()).containsExactly("manager.b@company.com");
            assertThat(preview.basis()).isEqualTo(RoutingBasis.MANUAL);
        }

        @Test
        @DisplayName("une offre sans destinataire naturel reste transmissible : le RH choisit hors proposition")
        void previewOnUnroutedOfferProposesNothing() {
            Candidate candidate = dossier(132L, CandidateStatus.PHONE_SCREENING);
            candidate.getJobOffer().setDepartment(department(9L, "HRAccess", "HRACCESS"));
            candidate.getJobOffer().setJobFamily(null);
            candidate.getJobOffer().setManagerEmail(null);
            when(candidateRepository.findById(132L)).thenReturn(Optional.of(candidate));
            when(userRepository.findManagersByDepartment(9L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of());

            ManagerRoutingService.RoutingResult preview = candidateService.routingPreview(132L);

            assertThat(preview.isResolved()).isFalse();
            assertThat(preview.basis()).isEqualTo(RoutingBasis.UNRESOLVED);
        }
    }
}
