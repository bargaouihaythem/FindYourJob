package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Barème d'expérience des offres (Junior 0-2 / Confirmé 2-4 / Senior 5-8 / Expert 8+)")
class ExperienceLevelNormsTest {

    @Nested
    @DisplayName("Lecture du minimum d'années exigé")
    class ReadingMinimum {

        @Test
        @DisplayName("Les paliers du barème sont relus dans les deux sens")
        void readsNormBands() {
            assertThat(ExperienceLevelNorms.parseMinYears(ExperienceLevelNorms.JUNIOR_LABEL)).isZero();
            assertThat(ExperienceLevelNorms.parseMinYears(ExperienceLevelNorms.MID_LABEL)).isEqualTo(2);
            assertThat(ExperienceLevelNorms.parseMinYears(ExperienceLevelNorms.SENIOR_LABEL)).isEqualTo(5);
            assertThat(ExperienceLevelNorms.parseMinYears(ExperienceLevelNorms.EXPERT_LABEL)).isEqualTo(8);
        }

        @Test
        @DisplayName("Une saisie libre est ramenée au palier le plus proche")
        void readsFreeWording() {
            assertThat(ExperienceLevelNorms.parseMinYears("junior")).isZero();
            assertThat(ExperienceLevelNorms.parseMinYears("Étudiant")).isZero();
            assertThat(ExperienceLevelNorms.parseMinYears("Confirmé")).isEqualTo(2);
            assertThat(ExperienceLevelNorms.parseMinYears("senior")).isEqualTo(5);
            assertThat(ExperienceLevelNorms.parseMinYears("Tech Lead")).isEqualTo(8);
            assertThat(ExperienceLevelNorms.parseMinYears("à partir de 3 ans d'expérience")).isEqualTo(3);
        }

        @Test
        @DisplayName("Aucun minimum inventé quand l'offre ne chiffre rien")
        void doesNotInventAMinimum() {
            assertThat(ExperienceLevelNorms.parseMinYears(null)).isNull();
            assertThat(ExperienceLevelNorms.parseMinYears("  ")).isNull();
            assertThat(ExperienceLevelNorms.parseMinYears("Télétravail partiel")).isNull();
        }
    }

    @Nested
    @DisplayName("Réconciliation des deux champs à la saisie")
    class Reconciliation {

        @Test
        @DisplayName("Le niveau choisi remplit la fourchette absente")
        void seniorityFillsMissingBand() {
            assertThat(ExperienceLevelNorms.reconcileExperienceLabel(JobOffer.SeniorityLevel.SENIOR, null))
                    .isEqualTo(ExperienceLevelNorms.SENIOR_LABEL);
            assertThat(ExperienceLevelNorms.reconcileSeniority(JobOffer.SeniorityLevel.MID,
                    ExperienceLevelNorms.MID_LABEL)).isEqualTo(JobOffer.SeniorityLevel.MID);
        }

        @Test
        @DisplayName("La fourchette chiffrée fait foi sur le niveau : « SENIOR » avec « 2-3 ans » devient Confirmé/MID")
        void numericBandWinsOverSeniority() {
            String label = ExperienceLevelNorms.reconcileExperienceLabel(
                    JobOffer.SeniorityLevel.SENIOR, "2-3 ans");
            assertThat(label).isEqualTo(ExperienceLevelNorms.MID_LABEL);
            assertThat(ExperienceLevelNorms.reconcileSeniority(JobOffer.SeniorityLevel.SENIOR, label))
                    .isEqualTo(JobOffer.SeniorityLevel.MID);
        }

        @Test
        @DisplayName("Une exigence haute n'est pas rabotée par le palier Senior")
        void highRequirementIsNotLowered() {
            assertThat(ExperienceLevelNorms.reconcileExperienceLabel(JobOffer.SeniorityLevel.SENIOR, "10+ ans"))
                    .isEqualTo(ExperienceLevelNorms.EXPERT_LABEL);
        }

        @Test
        @DisplayName("Une mention non chiffrable reste affichée telle quelle")
        void keepsUnclearWording() {
            assertThat(ExperienceLevelNorms.reconcileExperienceLabel(null, "À l'écoute du marché"))
                    .isEqualTo("À l'écoute du marché");
        }

        @Test
        @DisplayName("Junior reste mesurable : le minimum 0 an est bien lu")
        void juniorBandIsMeasurable() {
            assertThat(ExperienceLevelNorms.seniorityForMinYears(0)).isEqualTo(JobOffer.SeniorityLevel.JUNIOR);
            assertThat(ExperienceLevelNorms.minYearsFor(JobOffer.SeniorityLevel.JUNIOR)).isZero();
        }
    }
}
