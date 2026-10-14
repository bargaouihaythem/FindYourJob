package com.recrutement.app.service;

import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link ManagerRoutingService}.
 *
 * Tests couverts :
 * - resolveManagerEmails() : filet de sécurité (JobOffer.managerEmail) et niveaux
 *                            historique famille / département
 * - resolve()              : chaîne exclusive à 4 niveaux, base d'aiguillage tracée,
 *                            aucune adresse inventée quand rien ne résout
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ManagerRoutingService - Tests unitaires")
class ManagerRoutingServiceTest {

    @Mock UserRepository userRepository;

    @InjectMocks
    ManagerRoutingService managerRoutingService;

    private JobOffer jobOfferWithFamily(JobOffer.JobFamily family, String managerEmail) {
        JobOffer jobOffer = new JobOffer();
        jobOffer.setJobFamily(family);
        jobOffer.setManagerEmail(managerEmail);
        return jobOffer;
    }

    private User managerWithEmail(String email) {
        User user = new User();
        user.setEmail(email);
        return user;
    }

    @Nested
    @DisplayName("resolveManagerEmails()")
    class ResolveManagerEmailsTests {

        @Test
        @DisplayName("retourne l'email de l'unique manager assigné à la famille de métier de l'offre")
        void shouldReturnAssignedManagerEmailWhenFound() {
            JobOffer jobOffer = jobOfferWithFamily(JobOffer.JobFamily.CS, "manuel@company.com");
            when(userRepository.findManagersByJobFamily(JobOffer.JobFamily.CS, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(managerWithEmail("manager.cs@company.com")));

            List<String> result = managerRoutingService.resolveManagerEmails(jobOffer);

            assertThat(result).containsExactly("manager.cs@company.com");
        }

        @Test
        @DisplayName("retourne TOUS les managers assignés à la famille de métier, pas seulement le premier")
        void shouldReturnAllAssignedManagersWhenMultipleFound() {
            JobOffer jobOffer = jobOfferWithFamily(JobOffer.JobFamily.PRODOPS, "manuel@company.com");
            when(userRepository.findManagersByJobFamily(JobOffer.JobFamily.PRODOPS, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(
                            managerWithEmail("manager1.prodops@company.com"),
                            managerWithEmail("manager2.prodops@company.com")));

            List<String> result = managerRoutingService.resolveManagerEmails(jobOffer);

            assertThat(result).containsExactlyInAnyOrder(
                    "manager1.prodops@company.com", "manager2.prodops@company.com");
        }

        @Test
        @DisplayName("retombe sur JobOffer.managerEmail si aucun manager n'est assigné à cette famille")
        void shouldFallBackToManualManagerEmailWhenNoneAssigned() {
            JobOffer jobOffer = jobOfferWithFamily(JobOffer.JobFamily.RSD, "manuel@company.com");
            when(userRepository.findManagersByJobFamily(JobOffer.JobFamily.RSD, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of());

            List<String> result = managerRoutingService.resolveManagerEmails(jobOffer);

            assertThat(result).containsExactly("manuel@company.com");
        }

        @Test
        @DisplayName("retombe sur JobOffer.managerEmail si l'offre n'a pas de famille de métier, sans appeler le repository")
        void shouldFallBackWhenNoJobFamily() {
            JobOffer jobOffer = jobOfferWithFamily(null, "manuel@company.com");

            List<String> result = managerRoutingService.resolveManagerEmails(jobOffer);

            assertThat(result).containsExactly("manuel@company.com");
        }

        @Test
        @DisplayName("retourne une liste vide si l'offre est null")
        void shouldReturnEmptyListWhenJobOfferIsNull() {
            assertThat(managerRoutingService.resolveManagerEmails(null)).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // resolve() — la chaîne est exclusive et ne remonte jamais une adresse inventée
    // ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("resolve() - chaîne à 4 niveaux")
    class ResolveChainTests {

        private User manager(Long id, String email, String firstName, String lastName) {
            User user = new User();
            user.setId(id);
            user.setEmail(email);
            user.setFirstName(firstName);
            user.setLastName(lastName);
            user.setRoles(Set.of(new Role(Role.ERole.ROLE_MANAGER)));
            return user;
        }

        private Department department(Long id, String name, String code) {
            Department department = new Department(name, code);
            department.setId(id);
            return department;
        }

        private JobOffer offer(Department department, JobOffer.JobFamily family, String managerEmail) {
            JobOffer jobOffer = new JobOffer();
            jobOffer.setDepartment(department);
            jobOffer.setJobFamily(family);
            jobOffer.setManagerEmail(managerEmail);
            return jobOffer;
        }

        @Test
        @DisplayName("le manager désigné sur l'offre prime sur le département et la famille")
        void designatedManagerBeatsDepartmentAndFamily() {
            User designated = manager(9L, "marge@company.com", "Sophie", "Martin");
            JobOffer jobOffer = offer(department(1L, "DevOps", "DEVOPS"), JobOffer.JobFamily.CS, "manuel@company.com");
            jobOffer.setHiringManager(designated);

            ManagerRoutingService.RoutingResult result = managerRoutingService.resolve(jobOffer);

            assertThat(result.basis()).isEqualTo(RoutingBasis.OFFER_MANAGER);
            assertThat(result.emails()).containsExactly("marge@company.com");
            assertThat(result.primary().fullName()).isEqualTo("Sophie Martin");
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("un compte désigné qui n'a plus le rôle MANAGER est ignoré : on redescend d'un niveau")
        void designatedAccountWithoutManagerRoleIsIgnored() {
            User notAnymoreManager = new User();
            notAnymoreManager.setId(9L);
            notAnymoreManager.setEmail("rh@company.com");
            notAnymoreManager.setRoles(Set.of(new Role(Role.ERole.ROLE_HR)));

            JobOffer jobOffer = offer(department(1L, "DevOps", "DEVOPS"), null, "manuel@company.com");
            jobOffer.setHiringManager(notAnymoreManager);
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(manager(11L, "devops.1@company.com", null, null)));

            ManagerRoutingService.RoutingResult result = managerRoutingService.resolve(jobOffer);

            assertThat(result.basis()).isEqualTo(RoutingBasis.DEPARTMENT);
            assertThat(result.emails()).containsExactly("devops.1@company.com");
        }

        @Test
        @DisplayName("le département fait autorité : la famille de métier n'est pas interrogée")
        void departmentWinsOverJobFamily() {
            JobOffer jobOffer = offer(department(1L, "DevOps", "DEVOPS"), JobOffer.JobFamily.CS, null);
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(
                            manager(11L, "devops.1@company.com", "Un", "Un"),
                            manager(12L, "devops.2@company.com", "Deux", "Deux")));

            ManagerRoutingService.RoutingResult result = managerRoutingService.resolve(jobOffer);

            assertThat(result.basis()).isEqualTo(RoutingBasis.DEPARTMENT);
            assertThat(result.emails()).containsExactly("devops.1@company.com", "devops.2@company.com");
            verify(userRepository, never()).findManagersByJobFamily(any(), any());
        }

        @Test
        @DisplayName("un département sans manager retombe sur la famille de métier (cas HRAccess)")
        void departmentWithoutManagerFallsBackOnJobFamily() {
            JobOffer jobOffer = offer(department(4L, "HRAccess", "HRACCESS"), JobOffer.JobFamily.RSD, null);
            when(userRepository.findManagersByDepartment(4L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of());
            when(userRepository.findManagersByJobFamily(JobOffer.JobFamily.RSD, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(manager(21L, "rsd@company.com", null, null)));

            ManagerRoutingService.RoutingResult result = managerRoutingService.resolve(jobOffer);

            assertThat(result.basis()).isEqualTo(RoutingBasis.JOB_FAMILY);
            assertThat(result.emails()).containsExactly("rsd@company.com");
        }

        @Test
        @DisplayName("aucun niveau ne résout : résultat UNRESOLVED, jamais une adresse de repli")
        void unresolvedWhenNothingMatches() {
            JobOffer jobOffer = offer(department(4L, "HRAccess", "HRACCESS"), null, null);
            when(userRepository.findManagersByDepartment(4L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of());

            ManagerRoutingService.RoutingResult result = managerRoutingService.resolve(jobOffer);

            assertThat(result.isResolved()).isFalse();
            assertThat(result.basis()).isEqualTo(RoutingBasis.UNRESOLVED);
            assertThat(result.emails()).isEmpty();
            assertThat(result.primary()).isNull();
        }

        @Test
        @DisplayName("des managers en doublon ne sont pas notifiés deux fois")
        void duplicateManagersAreRemoved() {
            JobOffer jobOffer = offer(department(1L, "DevOps", "DEVOPS"), null, null);
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(
                            manager(11L, "devops.1@company.com", null, null),
                            manager(11L, "devops.1@company.com", null, null)));

            assertThat(managerRoutingService.resolve(jobOffer).emails())
                    .containsExactly("devops.1@company.com");
        }

        @Test
        @DisplayName("un manager sans e-mail ne peut pas être destinataire")
        void managerWithoutEmailIsSkipped() {
            JobOffer jobOffer = offer(department(1L, "DevOps", "DEVOPS"), null, null);
            when(userRepository.findManagersByDepartment(1L, Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(manager(11L, null, null, null)));

            assertThat(managerRoutingService.resolve(jobOffer).isResolved()).isFalse();
        }
    }
}
