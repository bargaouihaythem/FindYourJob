package com.recrutement.app.service;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.dto.JobOfferResponse;
import com.recrutement.app.dto.ManagerOptionResponse;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.DepartmentRepository;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour {@link JobOfferService}.
 *
 * Tests couverts :
 * - createJobOffer() : création, statut par défaut, résolution du département, utilisateur inconnu
 * - updateJobOffer()  : mise à jour, offre inconnue
 * - deleteJobOffer()  : suppression, offre inconnue
 * - getJobOfferById() : lecture, offre inconnue
 * - getJobOffersByStatus() : délégation au repository
 * - applyHiringManager() : rôle MANAGER exigé, département de l'offre, dépassement tracé
 * - getAssignableManagers() / routingPreview() : aide à l'aiguillage côté RH
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JobOfferService - Tests unitaires")
class JobOfferServiceTest {

    @Mock JobOfferRepository jobOfferRepository;
    @Mock UserRepository userRepository;
    @Mock DepartmentRepository departmentRepository;
    @Mock ManagerRoutingService managerRoutingService;
    @Mock AuditLogService auditLogService;

    @InjectMocks
    JobOfferService jobOfferService;

    private JobOfferRequest makeRequest() {
        JobOfferRequest request = new JobOfferRequest();
        request.setTitle("Développeur Java");
        request.setDescription("Poste de développeur backend");
        request.setRequiredSkills("Java, Spring Boot");
        request.setExperienceLevel("MID");
        request.setContractType("CDI");
        request.setLocation("Paris");
        request.setSalaryRange("40-50K");
        request.setDeadline(LocalDateTime.now().plusDays(30));
        request.setManagerEmail("manager@company.com");
        return request;
    }

    private User makeUser(String username) {
        User user = new User();
        user.setId(1L);
        user.setUsername(username);
        user.setEmail(username + "@company.com");
        return user;
    }

    @Nested
    @DisplayName("createJobOffer()")
    class CreateJobOfferTests {

        @Test
        @DisplayName("crée l'offre, l'associe au créateur et applique le statut ACTIVE par défaut")
        void shouldCreateJobOfferWithDefaultActiveStatus() {
            User user = makeUser("rh_user");
            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(user));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            JobOfferResponse response = jobOfferService.createJobOffer(makeRequest(), "rh_user");

            assertThat(response.getTitle()).isEqualTo("Développeur Java");
            assertThat(response.getStatus()).isEqualTo(JobOffer.JobStatus.ACTIVE);
            verify(jobOfferRepository).save(argThat(o -> o.getCreatedBy() == user));
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si l'utilisateur créateur n'existe pas")
        void shouldThrowWhenUserNotFound() {
            when(userRepository.findByUsername("inconnu")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.createJobOffer(makeRequest(), "inconnu"))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(jobOfferRepository, never()).save(any());
        }

        @Test
        @DisplayName("résout et associe le département quand departmentId est fourni")
        void shouldResolveDepartmentWhenProvided() {
            User user = makeUser("rh_user");
            Department department = new Department("R&D", "R&D");
            department.setId(5L);

            JobOfferRequest request = makeRequest();
            request.setDepartmentId(5L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(user));
            when(departmentRepository.findById(5L)).thenReturn(Optional.of(department));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            JobOfferResponse response = jobOfferService.createJobOffer(request, "rh_user");

            assertThat(response.getDepartmentId()).isEqualTo(5L);
            assertThat(response.getDepartmentName()).isEqualTo("R&D");
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si le département fourni n'existe pas")
        void shouldThrowWhenDepartmentNotFound() {
            User user = makeUser("rh_user");
            JobOfferRequest request = makeRequest();
            request.setDepartmentId(999L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(user));
            when(departmentRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.createJobOffer(request, "rh_user"))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(jobOfferRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateJobOffer()")
    class UpdateJobOfferTests {

        @Test
        @DisplayName("met à jour les champs de l'offre existante")
        void shouldUpdateExistingJobOffer() {
            JobOffer existing = new JobOffer();
            existing.setId(1L);
            existing.setTitle("Ancien titre");
            existing.setStatus(JobOffer.JobStatus.ACTIVE);

            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            JobOfferRequest request = makeRequest();
            request.setTitle("Nouveau titre");

            JobOfferResponse response = jobOfferService.updateJobOffer(1L, request);

            assertThat(response.getTitle()).isEqualTo("Nouveau titre");
            verify(jobOfferRepository).save(existing);
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si l'offre n'existe pas")
        void shouldThrowWhenJobOfferNotFound() {
            when(jobOfferRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.updateJobOffer(99L, makeRequest()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("deleteJobOffer()")
    class DeleteJobOfferTests {

        @Test
        @DisplayName("supprime l'offre existante")
        void shouldDeleteExistingJobOffer() {
            JobOffer existing = new JobOffer();
            existing.setId(1L);
            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(existing));

            jobOfferService.deleteJobOffer(1L);

            verify(jobOfferRepository).delete(existing);
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si l'offre à supprimer n'existe pas")
        void shouldThrowWhenDeletingUnknownJobOffer() {
            when(jobOfferRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.deleteJobOffer(99L))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(jobOfferRepository, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("getJobOfferById()")
    class GetJobOfferByIdTests {

        @Test
        @DisplayName("retourne l'offre demandée")
        void shouldReturnJobOffer() {
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setTitle("Développeur Java");
            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(jobOffer));

            JobOfferResponse response = jobOfferService.getJobOfferById(1L);

            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getTitle()).isEqualTo("Développeur Java");
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si l'offre n'existe pas")
        void shouldThrowWhenNotFound() {
            when(jobOfferRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.getJobOfferById(99L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getJobOffersByStatus()")
    class GetJobOffersByStatusTests {

        @Test
        @DisplayName("retourne uniquement les offres du statut demandé")
        void shouldReturnJobOffersWithGivenStatus() {
            JobOffer active1 = new JobOffer();
            active1.setId(1L);
            active1.setStatus(JobOffer.JobStatus.ACTIVE);
            JobOffer active2 = new JobOffer();
            active2.setId(2L);
            active2.setStatus(JobOffer.JobStatus.ACTIVE);

            when(jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE))
                    .thenReturn(List.of(active1, active2));

            List<JobOfferResponse> result = jobOfferService.getJobOffersByStatus(JobOffer.JobStatus.ACTIVE);

            assertThat(result).hasSize(2);
            assertThat(result).extracting("status").containsOnly(JobOffer.JobStatus.ACTIVE);
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // ROUTAGE — le manager recruteur est une décision explicite du RH
    // ════════════════════════════════════════════════════════════════════

    private Department makeDepartment(Long id, String name, String code) {
        Department department = new Department(name, code);
        department.setId(id);
        return department;
    }

    private User makeManager(Long id, String username, Department department) {
        User manager = makeUser(username);
        manager.setId(id);
        manager.setRoles(new HashSet<>(List.of(new Role(Role.ERole.ROLE_MANAGER))));
        manager.setDepartment(department);
        return manager;
    }

    @Nested
    @DisplayName("Désignation du manager recruteur")
    class HiringManagerTests {

        @Test
        @DisplayName("associe le manager recruteur et le renvoie dans la réponse")
        void shouldAssignHiringManager() {
            Department consulting = makeDepartment(3L, "Consulting Services", "CS");
            User manager = makeManager(11L, "manager.cs", consulting);

            JobOfferRequest request = makeRequest();
            request.setDepartmentId(3L);
            request.setHiringManagerId(11L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(makeUser("rh_user")));
            when(departmentRepository.findById(3L)).thenReturn(Optional.of(consulting));
            when(userRepository.findById(11L)).thenReturn(Optional.of(manager));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            JobOfferResponse response = jobOfferService.createJobOffer(request, "rh_user");

            assertThat(response.getHiringManagerId()).isEqualTo(11L);
            assertThat(response.getHiringManagerEmail()).isEqualTo("manager.cs@company.com");
            verify(jobOfferRepository).save(argThat(o -> o.getHiringManager() == manager));
            verifyNoInteractions(auditLogService);
        }

        @Test
        @DisplayName("refuse un compte qui n'a pas le rôle MANAGER")
        void shouldRejectUserWithoutManagerRole() {
            User candidat = makeUser("candidat");
            candidat.setRoles(new HashSet<>(List.of(new Role(Role.ERole.ROLE_USER))));

            JobOfferRequest request = makeRequest();
            request.setHiringManagerId(2L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(makeUser("rh_user")));
            when(userRepository.findById(2L)).thenReturn(Optional.of(candidat));

            assertThatThrownBy(() -> jobOfferService.createJobOffer(request, "rh_user"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("rôle MANAGER");

            verify(jobOfferRepository, never()).save(any());
        }

        @Test
        @DisplayName("lève ResourceNotFoundException si le manager recruteur n'existe pas")
        void shouldThrowWhenHiringManagerUnknown() {
            JobOfferRequest request = makeRequest();
            request.setHiringManagerId(99L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(makeUser("rh_user")));
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.createJobOffer(request, "rh_user"))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(jobOfferRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuse un manager hors du département de l'offre sans dépassement assumé")
        void shouldRefuseCrossDepartmentManagerWithoutOverride() {
            Department consulting = makeDepartment(3L, "Consulting Services", "CS");
            User qaManager = makeManager(12L, "manager.qa", makeDepartment(4L, "QA", "QA"));

            JobOfferRequest request = makeRequest();
            request.setDepartmentId(3L);
            request.setHiringManagerId(12L);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(makeUser("rh_user")));
            when(departmentRepository.findById(3L)).thenReturn(Optional.of(consulting));
            when(userRepository.findById(12L)).thenReturn(Optional.of(qaManager));

            assertThatThrownBy(() -> jobOfferService.createJobOffer(request, "rh_user"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("n'appartient pas au département");

            verify(jobOfferRepository, never()).save(any());
        }

        @Test
        @DisplayName("accepte le dépassement assumé et trace MANAGER_DEPARTMENT_OVERRIDE")
        void shouldAcceptOverrideAndAuditIt() {
            Department consulting = makeDepartment(3L, "Consulting Services", "CS");
            User qaManager = makeManager(12L, "manager.qa", makeDepartment(4L, "QA", "QA"));

            JobOfferRequest request = makeRequest();
            request.setDepartmentId(3L);
            request.setHiringManagerId(12L);
            request.setAllowManagerDepartmentMismatch(true);

            when(userRepository.findByUsername("rh_user")).thenReturn(Optional.of(makeUser("rh_user")));
            when(departmentRepository.findById(3L)).thenReturn(Optional.of(consulting));
            when(userRepository.findById(12L)).thenReturn(Optional.of(qaManager));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> {
                JobOffer toSave = inv.getArgument(0);
                toSave.setId(77L);
                return toSave;
            });

            JobOfferResponse response = jobOfferService.createJobOffer(request, "rh_user");

            assertThat(response.getHiringManagerId()).isEqualTo(12L);
            verify(auditLogService).log("JOB_OFFER", 77L, "MANAGER_DEPARTMENT_OVERRIDE",
                    "Consulting Services", "manager.qa@company.com");
        }

        @Test
        @DisplayName("retire le manager recruteur quand le champ est vidé")
        void shouldClearHiringManagerWhenNotProvided() {
            JobOffer existing = new JobOffer();
            existing.setId(1L);
            existing.setHiringManager(makeManager(11L, "manager.cs", makeDepartment(3L, "Consulting Services", "CS")));

            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(jobOfferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            JobOfferResponse response = jobOfferService.updateJobOffer(1L, makeRequest());

            assertThat(response.getHiringManagerId()).isNull();
            verify(jobOfferRepository).save(argThat(o -> o.getHiringManager() == null));
        }
    }

    @Nested
    @DisplayName("getAssignableManagers() / routingPreview()")
    class RoutingSupportTests {

        @Test
        @DisplayName("classe les managers du département choisi en tête de liste")
        void shouldOrderDepartmentManagersFirst() {
            User consultingManager = makeManager(11L, "manager.cs", makeDepartment(3L, "Consulting Services", "CS"));
            User qaManager = makeManager(12L, "manager.qa", makeDepartment(4L, "QA", "QA"));
            User noEmailManager = makeManager(13L, "manager.sans", makeDepartment(3L, "Consulting Services", "CS"));
            noEmailManager.setEmail(" ");
            when(userRepository.findByRoleName(Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(qaManager, consultingManager, noEmailManager));

            List<ManagerOptionResponse> options = jobOfferService.getAssignableManagers(3L);

            assertThat(options).extracting(ManagerOptionResponse::getId)
                    .containsExactly(11L, 12L);
            assertThat(options.get(0).getDepartmentId()).isEqualTo(3L);
        }

        @Test
        @DisplayName("sans département filtrant, renvoie tous les managers joignables")
        void shouldReturnAllManagersWhenNoDepartment() {
            when(userRepository.findByRoleName(Role.ERole.ROLE_MANAGER))
                    .thenReturn(List.of(makeManager(11L, "manager.cs", null),
                                         makeManager(12L, "manager.qa", null)));

            assertThat(jobOfferService.getAssignableManagers(null))
                    .extracting(ManagerOptionResponse::getId)
                    .containsExactly(11L, 12L);
        }

        @Test
        @DisplayName("l'aperçu du routage délègue à la chaîne de résolution")
        void shouldDelegateRoutingPreview() {
            JobOffer jobOffer = new JobOffer();
            jobOffer.setId(1L);
            jobOffer.setTitle("Consultant Fonctionnel");
            when(jobOfferRepository.findById(1L)).thenReturn(Optional.of(jobOffer));
            when(managerRoutingService.resolve(jobOffer)).thenReturn(
                    new ManagerRoutingService.RoutingResult(
                            List.of(new ManagerRoutingService.RoutedManager(11L, "Alice Blanc",
                                    "manager.a@company.com")),
                            RoutingBasis.DEPARTMENT));

            ManagerRoutingService.RoutingResult preview = jobOfferService.routingPreview(1L);

            assertThat(preview.isResolved()).isTrue();
            assertThat(preview.emails()).containsExactly("manager.a@company.com");
        }

        @Test
        @DisplayName("l'aperçu d'une offre inconnue lève ResourceNotFoundException")
        void shouldThrowWhenOfferUnknownForPreview() {
            when(jobOfferRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> jobOfferService.routingPreview(99L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
