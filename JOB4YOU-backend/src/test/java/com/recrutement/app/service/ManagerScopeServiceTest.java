package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link ManagerScopeService} — la règle unique
 * « un manager voit les dossiers dont il est destinataire ».
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ManagerScopeService - visibilité = aiguillage")
class ManagerScopeServiceTest {

    @Mock ManagerRoutingService managerRoutingService;

    @InjectMocks
    ManagerScopeService managerScopeService;

    private static final Department QA = department(2L, "Quality Assurance", "QA");

    private static Department department(Long id, String name, String code) {
        Department department = new Department(name, code);
        department.setId(id);
        return department;
    }

    private Candidate dossier(String frozenEmails) {
        Candidate candidate = new Candidate();
        candidate.setId(1L);
        candidate.setEmail("candidat@example.com");
        candidate.setRoutedManagerEmails(frozenEmails);
        candidate.setRoutedAt(frozenEmails == null ? null : LocalDateTime.now());
        candidate.setRoutingBasis(frozenEmails == null ? null : RoutingBasis.DEPARTMENT);
        JobOffer jobOffer = new JobOffer();
        jobOffer.setId(1L);
        jobOffer.setDepartment(QA);
        candidate.setJobOffer(jobOffer);
        return candidate;
    }

    private User manager(String email) {
        User user = new User();
        user.setId(50L);
        user.setUsername("manager");
        user.setEmail(email);
        user.setRoles(Set.of(new Role(Role.ERole.ROLE_MANAGER)));
        user.setDepartment(QA);
        return user;
    }

    @Nested
    @DisplayName("recipientsOf()")
    class RecipientsOfTests {

        @Test
        @DisplayName("utilise la liste gelée dès qu'elle existe, sans relancer la résolution")
        void usesFrozenListWhenPresent() {
            Candidate candidate = dossier("manager.a@company.com,manager.b@company.com");

            assertThat(managerScopeService.recipientsOf(candidate))
                    .containsExactly("manager.a@company.com", "manager.b@company.com");
            verifyNoInteractions(managerRoutingService);
        }

        @Test
        @DisplayName("retombe sur la résolution de l'offre tant que le dossier n'est pas transmis")
        void fallsBackOnLiveResolutionBeforeRouting() {
            Candidate candidate = dossier(null);
            when(managerRoutingService.resolve(candidate.getJobOffer()))
                    .thenReturn(new ManagerRoutingService.RoutingResult(
                            List.of(new ManagerRoutingService.RoutedManager(11L, "Alice Blanc", "manager.a@company.com")),
                            RoutingBasis.DEPARTMENT));

            assertThat(managerScopeService.recipientsOf(candidate))
                    .containsExactly("manager.a@company.com");
        }

        @Test
        @DisplayName("candidat null : aucun destinataire plutôt qu'une exception")
        void returnsEmptyForNullCandidate() {
            assertThat(managerScopeService.recipientsOf(null)).isEmpty();
        }
    }

    @Nested
    @DisplayName("isRecipient()")
    class IsRecipientTests {

        @Test
        @DisplayName("un destinataire gelé est reconnu, quelle que soit la casse")
        void recognisesFrozenRecipientIgnoringCase() {
            Candidate candidate = dossier("manager.a@company.com");

            assertThat(managerScopeService.isRecipient(candidate, manager("MANAGER.A@company.com"))).isTrue();
        }

        @Test
        @DisplayName("un manager du même département mais non destinataire est refusé")
        void rejectsSameDepartmentNonRecipient() {
            Candidate candidate = dossier("manager.a@company.com");

            assertThat(managerScopeService.isRecipient(candidate, manager("manager.qa@company.com"))).isFalse();
        }

        @Test
        @DisplayName("un manager sans e-mail n'est jamais destinataire")
        void rejectsManagerWithoutEmail() {
            assertThat(managerScopeService.isRecipient(dossier("manager.a@company.com"), manager(null))).isFalse();
            assertThat(managerScopeService.isRecipient(dossier("manager.a@company.com"), null)).isFalse();
        }
    }
}
