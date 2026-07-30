package com.recrutement.app.service;

import com.recrutement.app.entity.CV;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link AiScoringService}.
 *
 * Tests couverts :
 * - mode Cohere (client configuré et disponible) : score = pondération des 3 critères
 * - mode simulé (Cohere indisponible/exception)   : fallback automatique, score technique déterministe
 * - computeTechnicalScore()                        : matching de mots-clés (via le mode simulé)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AiScoringService - Tests unitaires")
class AiScoringServiceTest {

    @Mock
    CohereClient cohereClient;

    AiScoringService aiScoringService;

    @BeforeEach
    void setUp() {
        aiScoringService = new AiScoringService(cohereClient);
        // Les poids sont normalement injectés par Spring via @Value ; on reproduit les valeurs par défaut
        ReflectionTestUtils.setField(aiScoringService, "weightTechnical", 0.5);
        ReflectionTestUtils.setField(aiScoringService, "weightCommunication", 0.2);
        ReflectionTestUtils.setField(aiScoringService, "weightSeniority", 0.3);
    }

    private Candidate candidateWithCoverLetter(String coverLetter, String requiredSkills) {
        Candidate candidate = new Candidate();
        candidate.setCoverLetter(coverLetter);

        JobOffer jobOffer = new JobOffer();
        jobOffer.setTitle("Développeur Full-Stack");
        jobOffer.setRequiredSkills(requiredSkills);
        jobOffer.setExperienceLevel("MID");
        candidate.setJobOffer(jobOffer);

        return candidate;
    }

    @Nested
    @DisplayName("Mode Cohere (client disponible)")
    class CohereModeTests {

        @Test
        @DisplayName("utilise le score retourné par Cohere et pondère correctement le score final")
        void shouldUseCohereScoreAndApplyWeights() {
            Candidate candidate = candidateWithCoverLetter("Je maîtrise Java et Spring Boot", "Java, Spring Boot, Angular");

            CohereClient.ScoreBreakdown breakdown = new CohereClient.ScoreBreakdown();
            breakdown.technical = 80;
            breakdown.communication = 70;
            breakdown.seniority = 60;
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(breakdown);

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.source).isEqualTo("COHERE");
            assertThat(result.technicalScore).isEqualTo(80);
            assertThat(result.communicationScore).isEqualTo(70);
            assertThat(result.seniorityMatchScore).isEqualTo(60);
            // 80*0.5 + 70*0.2 + 60*0.3 = 40 + 14 + 18 = 72
            assertThat(result.finalScore).isEqualTo(72);
            assertThat(result.recommendation).isEqualTo("GOOD_MATCH");
        }

        @Test
        @DisplayName("recommandation EXCELLENT_MATCH si le score final est >= 85")
        void shouldRecommendExcellentMatchAboveThreshold() {
            Candidate candidate = candidateWithCoverLetter("Profil senior", "Java");

            CohereClient.ScoreBreakdown breakdown = new CohereClient.ScoreBreakdown();
            breakdown.technical = 95;
            breakdown.communication = 90;
            breakdown.seniority = 90;
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(breakdown);

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.finalScore).isGreaterThanOrEqualTo(85);
            assertThat(result.recommendation).isEqualTo("EXCELLENT_MATCH");
        }

        @Test
        @DisplayName("recommandation WEAK_MATCH si le score final est < 60")
        void shouldRecommendWeakMatchBelowThreshold() {
            Candidate candidate = candidateWithCoverLetter("Profil junior", "Java");

            CohereClient.ScoreBreakdown breakdown = new CohereClient.ScoreBreakdown();
            breakdown.technical = 20;
            breakdown.communication = 20;
            breakdown.seniority = 20;
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(breakdown);

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.finalScore).isLessThan(60);
            assertThat(result.recommendation).isEqualTo("WEAK_MATCH");
        }
    }

    @Nested
    @DisplayName("Mode simulé (fallback quand Cohere est indisponible)")
    class SimulatedModeTests {

        @Test
        @DisplayName("bascule en mode simulé si Cohere lève une exception")
        void shouldFallBackToSimulatedModeOnCohereFailure() {
            Candidate candidate = candidateWithCoverLetter("Je maîtrise Java et Spring Boot", "Java, Spring Boot, Angular");
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenThrow(new IllegalStateException("Cohere indisponible (réseau)"));

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.source).isEqualTo("SIMULATED");
            assertThat(result.finalScore).isBetween(0, 100);
        }

        @Test
        @DisplayName("computeTechnicalScore : le score technique reflète le pourcentage de compétences retrouvées dans le CV")
        void shouldComputeTechnicalScoreFromKeywordMatching() {
            // 2 compétences sur 3 retrouvées dans le texte du candidat → 67%
            Candidate candidate = candidateWithCoverLetter("Je maîtrise Java et Spring Boot", "Java, Spring Boot, Angular");
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenThrow(new IllegalStateException("Cohere indisponible"));

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.technicalScore).isEqualTo(67);
        }

        @Test
        @DisplayName("computeTechnicalScore : 100% si toutes les compétences requises sont présentes")
        void shouldReturn100WhenAllSkillsMatch() {
            Candidate candidate = candidateWithCoverLetter("Expert Java et Angular", "Java, Angular");
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenThrow(new IllegalStateException("Cohere indisponible"));

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.technicalScore).isEqualTo(100);
        }

        @Test
        @DisplayName("computeTechnicalScore : score plancher de 30 même si aucune compétence ne matche")
        void shouldApplyFloorScoreWhenNoSkillMatches() {
            Candidate candidate = candidateWithCoverLetter("Je fais de la vente et du marketing", "Java, Angular, Docker");
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), anyString()))
                    .thenThrow(new IllegalStateException("Cohere indisponible"));

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.technicalScore).isEqualTo(30);
        }

        @Test
        @DisplayName("computeTechnicalScore : 70 (neutre) si l'offre ne précise aucune compétence requise")
        void shouldReturnNeutralScoreWhenNoRequiredSkills() {
            Candidate candidate = candidateWithCoverLetter("Peu importe le contenu", "");
            when(cohereClient.scoreCandidate(anyString(), anyString(), anyString(), any()))
                    .thenThrow(new IllegalStateException("Cohere indisponible"));

            AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

            assertThat(result.technicalScore).isEqualTo(70);
        }
    }
}
