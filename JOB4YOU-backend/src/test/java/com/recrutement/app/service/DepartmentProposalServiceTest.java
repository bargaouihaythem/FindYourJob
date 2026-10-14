package com.recrutement.app.service;

import com.recrutement.app.entity.Department;
import com.recrutement.app.repository.DepartmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link DepartmentProposalService}.
 *
 * La proposition doit rester lexicale et déterministe : les mêmes mots produisent
 * toujours le même classement, et rien n'est décidé sans confirmation du RH.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DepartmentProposalService - proposition de rattachement")
class DepartmentProposalServiceTest {

    @Mock DepartmentRepository departmentRepository;

    @InjectMocks
    DepartmentProposalService departmentProposalService;

    private static Department department(Long id, String name, String code) {
        return new Department(id, name, code);
    }

    private static final Department RND = department(1L, "Recherche & Développement", "R&D");
    private static final Department QA = department(3L, "Quality Assurance", "QA");
    private static final Department DEVOPS = department(5L, "DevOps", "DEVOPS");
    private static final Department HRACCESS = department(4L, "HRAccess", "HRACCESS");

    @Nested
    @DisplayName("propose()")
    class ProposeTests {

        @Test
        @DisplayName("un intitulé de test et d'automatisation est proposé vers Quality Assurance")
        void proposesQaForTestingTitle() {
            when(departmentRepository.findAll()).thenReturn(List.of(RND, QA, DEVOPS, HRACCESS));

            List<DepartmentProposalService.Proposal> proposals = departmentProposalService.propose(
                    "Ingénieur Test & Automatisation", "Selenium, JUnit, stratégie de test");

            assertThat(proposals).isNotEmpty();
            assertThat(proposals.get(0).departmentCode()).isEqualTo("QA");
            assertThat(proposals.get(0).matchedTerms()).contains("test");
        }

        @Test
        @DisplayName("le libellé complet du département vaut plus qu'un mot isolé")
        void ranksFullDepartmentNameHigher() {
            when(departmentRepository.findAll()).thenReturn(List.of(RND, QA, DEVOPS, HRACCESS));

            List<DepartmentProposalService.Proposal> proposals =
                    departmentProposalService.propose("Stage Recherche & Développement", "innovation");

            assertThat(proposals.get(0).departmentCode()).isEqualTo("R&D");
        }

        @Test
        @DisplayName("aucun recoupement : liste vide, le RH choisit à la main")
        void returnsEmptyWhenNothingMatches() {
            when(departmentRepository.findAll()).thenReturn(List.of(RND, QA, DEVOPS, HRACCESS));

            assertThat(departmentProposalService.propose("Manutentionnaire d'entrepôt", "CACES 3"))
                    .isEmpty();
        }

        @Test
        @DisplayName("titre et compétences vides : aucune proposition")
        void returnsEmptyForBlankText() {
            assertThat(departmentProposalService.propose(null, "  ")).isEmpty();
        }

        @Test
        @DisplayName("les mots de remplissage ne font pas une proposition")
        void ignoresNoiseWords() {
            assertThat(departmentProposalService.propose
                    ("Recherche un profil pour offre de stage", "niveau junior temps plein"))
                    .isEmpty();

            verifyNoInteractions(departmentRepository);
        }

        @Test
        @DisplayName("au plus trois propositions, classées par score décroissant")
        void limitsAndSortsProposals() {
            when(departmentRepository.findAll()).thenReturn(List.of(RND, QA, DEVOPS, HRACCESS));

            List<DepartmentProposalService.Proposal> proposals = departmentProposalService.propose(
                    "Administrateur plateforme cloud et tests automatisés", "devops, infrastructure, automatisation");

            assertThat(proposals).hasSizeLessThanOrEqualTo(3);
            assertThat(proposals).isSortedAccordingTo(
                    (left, right) -> Integer.compare(right.score(), left.score()));
        }
    }
}
