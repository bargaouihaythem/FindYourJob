package com.recrutement.app.service;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.dto.JobOfferResponse;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
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
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JobOfferService - Tests unitaires")
class JobOfferServiceTest {

    @Mock JobOfferRepository jobOfferRepository;
    @Mock UserRepository userRepository;
    @Mock DepartmentRepository departmentRepository;

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
}
