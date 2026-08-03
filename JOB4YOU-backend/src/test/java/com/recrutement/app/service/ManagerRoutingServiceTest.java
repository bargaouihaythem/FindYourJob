package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link ManagerRoutingService}.
 *
 * Tests couverts :
 * - resolveManagerEmail() : manager trouvé pour la famille de métier de l'offre
 *                           vs. filet de sécurité (JobOffer.managerEmail)
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
}
