package com.recrutement.app.service;

import com.recrutement.app.dto.ScoringWeightProfileRequest;
import com.recrutement.app.dto.ScoringWeightProfileResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import com.recrutement.app.repository.ScoringWeightProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link ScoringWeightProfileService}.
 *
 * Tests couverts :
 * - resolveWeights() : profil trouvé vs. filet de sécurité (défaut) quand aucun profil / famille non renseignée
 * - upsert()          : création, mise à jour, rejet si la somme des poids != 1.0
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ScoringWeightProfileService - Tests unitaires")
class ScoringWeightProfileServiceTest {

    @Mock
    ScoringWeightProfileRepository scoringWeightProfileRepository;

    @InjectMocks
    ScoringWeightProfileService scoringWeightProfileService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(scoringWeightProfileService, "defaultWeightTechnical", 0.5);
        ReflectionTestUtils.setField(scoringWeightProfileService, "defaultWeightCommunication", 0.2);
        ReflectionTestUtils.setField(scoringWeightProfileService, "defaultWeightSeniority", 0.3);
    }

    @Nested
    @DisplayName("resolveWeights()")
    class ResolveWeightsTests {

        @Test
        @DisplayName("retourne les poids du profil quand il existe pour la famille/niveau")
        void shouldReturnProfileWeightsWhenFound() {
            ScoringWeightProfile profile = new ScoringWeightProfile();
            profile.setJobFamily(JobOffer.JobFamily.CS);
            profile.setSeniorityLevel(JobOffer.SeniorityLevel.JUNIOR);
            profile.setWeightTechnical(0.3);
            profile.setWeightCommunication(0.5);
            profile.setWeightSeniority(0.2);
            when(scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(
                    JobOffer.JobFamily.CS, JobOffer.SeniorityLevel.JUNIOR))
                    .thenReturn(Optional.of(profile));

            ScoringWeightProfileService.ScoringWeights weights = scoringWeightProfileService.resolveWeights(
                    JobOffer.JobFamily.CS, JobOffer.SeniorityLevel.JUNIOR);

            assertThat(weights.technical).isEqualTo(0.3);
            assertThat(weights.communication).isEqualTo(0.5);
            assertThat(weights.seniority).isEqualTo(0.2);
        }

        @Test
        @DisplayName("retombe sur les poids par défaut si aucun profil n'existe pour la combinaison")
        void shouldFallBackToDefaultWhenNoProfileFound() {
            when(scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(
                    JobOffer.JobFamily.RSD, JobOffer.SeniorityLevel.SENIOR))
                    .thenReturn(Optional.empty());

            ScoringWeightProfileService.ScoringWeights weights = scoringWeightProfileService.resolveWeights(
                    JobOffer.JobFamily.RSD, JobOffer.SeniorityLevel.SENIOR);

            assertThat(weights.technical).isEqualTo(0.5);
            assertThat(weights.communication).isEqualTo(0.2);
            assertThat(weights.seniority).isEqualTo(0.3);
        }

        @Test
        @DisplayName("retombe sur les poids par défaut si famille ou niveau non renseigné, sans appeler le repository")
        void shouldFallBackToDefaultWhenFamilyOrLevelMissing() {
            ScoringWeightProfileService.ScoringWeights weights = scoringWeightProfileService.resolveWeights(null, null);

            assertThat(weights.technical).isEqualTo(0.5);
            assertThat(weights.communication).isEqualTo(0.2);
            assertThat(weights.seniority).isEqualTo(0.3);
        }
    }

    @Nested
    @DisplayName("upsert()")
    class UpsertTests {

        @Test
        @DisplayName("crée un nouveau profil quand aucun n'existe pour la combinaison")
        void shouldCreateNewProfile() {
            when(scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(
                    JobOffer.JobFamily.PRODOPS, JobOffer.SeniorityLevel.MID))
                    .thenReturn(Optional.empty());
            when(scoringWeightProfileRepository.save(org.mockito.ArgumentMatchers.any(ScoringWeightProfile.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ScoringWeightProfileRequest request = new ScoringWeightProfileRequest(0.6, 0.1, 0.3);

            ScoringWeightProfileResponse response = scoringWeightProfileService.upsert(
                    JobOffer.JobFamily.PRODOPS, JobOffer.SeniorityLevel.MID, request, "rh@sopra.com");

            assertThat(response.getJobFamily()).isEqualTo(JobOffer.JobFamily.PRODOPS);
            assertThat(response.getSeniorityLevel()).isEqualTo(JobOffer.SeniorityLevel.MID);
            assertThat(response.getWeightTechnical()).isEqualTo(0.6);
            assertThat(response.getUpdatedBy()).isEqualTo("rh@sopra.com");
        }

        @Test
        @DisplayName("rejette la requête si la somme des poids n'est pas égale à 1.0")
        void shouldRejectWhenWeightsDoNotSumToOne() {
            ScoringWeightProfileRequest request = new ScoringWeightProfileRequest(0.6, 0.6, 0.3);

            assertThatThrownBy(() -> scoringWeightProfileService.upsert(
                    JobOffer.JobFamily.CS, JobOffer.SeniorityLevel.SENIOR, request, "rh@sopra.com"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("somme des 3 poids");
        }
    }
}
