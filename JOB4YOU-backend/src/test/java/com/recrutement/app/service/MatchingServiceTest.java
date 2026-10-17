package com.recrutement.app.service;

import com.recrutement.app.dto.JobMatchResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.repository.JobOfferRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link MatchingService}.
 *
 * L'appel à l'IA n'est pas testé ici (client non configuré : le service reste sur le
 * pré-filtrage mots-clés, source SIMULATED). Ce qui est verrouillé est le pré-filtrage
 * lui-même, puisque c'est lui qui décide des offres soumises à l'IA.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MatchingService - pré-filtrage du matching inverse")
class MatchingServiceTest {

    @Mock
    private JobOfferRepository jobOfferRepository;

    @Mock
    private CohereClient cohereClient;

    private MatchingService matchingService;

    @BeforeEach
    void setUp() {
        matchingService = new MatchingService();
        ReflectionTestUtils.setField(matchingService, "jobOfferRepository", jobOfferRepository);
        ReflectionTestUtils.setField(matchingService, "cohereClient", cohereClient);
        ReflectionTestUtils.setField(matchingService, "skillNormalizationService", new SkillNormalizationService());
    }

    private JobOffer offer(Long id, String title, String location, String contract, String requiredSkills) {
        JobOffer offer = new JobOffer();
        offer.setId(id);
        offer.setTitle(title);
        offer.setLocation(location);
        offer.setContractType(contract);
        offer.setRequiredSkills(requiredSkills);
        return offer;
    }

    @Test
    @DisplayName("un CV JavaScript pur ne fait jamais remonter une offre qui n'exige que Java")
    void javaOfferIsNotSuggestedForJavaScriptCv() {
        when(jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE)).thenReturn(List.of(
                offer(1L, "Analyste Données", "Lyon", "CDI", "Java, Spring Boot, PostgreSQL"),
                offer(2L, "Développeur Frontend JavaScript", "Lyon", "CDI", "JavaScript, React, TypeScript")
        ));

        // Intitulé sans aucun token commun avec le CV : seule la lecture des compétences peut
        // faire remonter l'offre 1. Avec l'ancienne sous-chaîne, « java » se trouvait à
        // l'intérieur de « javascript » et l'offre était proposée ; elle doit disparaître.
        List<JobMatchResponse> suggestions = matchingService.suggestOffers(
                "Développeur frontend : JavaScript, React, TypeScript, Node.js et HTML5.");

        assertThat(suggestions).extracting(JobMatchResponse::getJobOfferId).containsExactly(2L);
        assertThat(suggestions.get(0).getMatchScore()).isEqualTo(100);
    }

    @Test
    @DisplayName("les offres identiques sont dédupliquées avant le classement")
    void duplicatesAreCollapsed() {
        when(jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE)).thenReturn(List.of(
                offer(10L, "Ingénieur DevOps", "Tunis", "CDI", "Kubernetes, Terraform, AWS"),
                offer(11L, "Ingénieur DevOps", "Tunis", "CDI", "Kubernetes, Terraform, AWS"),
                offer(12L, "Ingénieur DevOps", "Paris", "CDI", "Kubernetes, Terraform, AWS")
        ));

        List<JobMatchResponse> suggestions = matchingService.suggestOffers(
                "Plateformes sur kubernetes, terraform et aws.");

        assertThat(suggestions).hasSize(2);
    }

    @Test
    @DisplayName("l'intitulé de l'offre, pondéré à 60 %, peut faire remonter une offre à elle seule")
    void titleAloneCanProduceASuggestion() {
        when(jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE)).thenReturn(List.of(
                offer(20L, "Ingénieur DevOps", "Lyon", "CDI", "Java, Angular, Spring Boot")
        ));

        // Aucune des trois compétences n'apparaît : sans le signal du titre, l'offre serait
        // notée 0 et écartée, alors que le profil correspond exactement à l'intitulé.
        List<JobMatchResponse> suggestions = matchingService.suggestOffers(
                "Ingénieur DevOps avec 6 ans d'expérience sur des plateformes conteneurisées.");

        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).getMatchScore()).isEqualTo(60);
    }

    @Test
    @DisplayName("une offre sans aucun rapport est écartée plutôt que proposée à 0")
    void zeroScoreOffersAreFilteredOut() {
        when(jobOfferRepository.findByStatus(JobOffer.JobStatus.ACTIVE)).thenReturn(List.of(
                offer(30L, "Chargé de communication interne", "Lyon", "CDI", "Rédaction, InDesign, événementiel")
        ));

        List<JobMatchResponse> suggestions = matchingService.suggestOffers(
                "Ingénieur noyau linux, C et assembleur.");

        assertThat(suggestions).isEmpty();
    }
}
