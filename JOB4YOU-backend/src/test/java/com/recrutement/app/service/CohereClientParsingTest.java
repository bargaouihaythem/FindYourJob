package com.recrutement.app.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests unitaires du parsing de la réponse de notation ({@link CohereClient#parseScores}).
 *
 * Le point verrouillé est le refus : une réponse sans les trois clés attendues doit lever,
 * donc faire basculer le calcul en mode dégradé avec validation humaine, au lieu de voir
 * des nombres récupérés dans le désordre.
 */
@DisplayName("CohereClient - parsing de la notation par critères")
class CohereClientParsingTest {

    private final CohereClient client = new CohereClient(null);

    @Test
    @DisplayName("lit les trois critères d'un objet JSON conforme")
    void readsThreeCriteria() {
        CohereClient.ScoreBreakdown breakdown =
                client.parseScores("{\"technique\": 84, \"communication\": 61, \"seniorite\": 72}");

        assertThat(breakdown.technical).isEqualTo(84);
        assertThat(breakdown.communication).isEqualTo(61);
        assertThat(breakdown.seniority).isEqualTo(72);
    }

    @Test
    @DisplayName("accepte les alias anglais et les valeurs écrites (« 86/100 »)")
    void acceptsAliasesAndTextualNumbers() {
        CohereClient.ScoreBreakdown breakdown = client.parseScores(
                "{\"technical\": \"86/100\", \"communication\": \"70 points\", \"senior\": 55}");

        assertThat(breakdown.technical).isEqualTo(86);
        assertThat(breakdown.communication).isEqualTo(70);
        assertThat(breakdown.seniority).isEqualTo(55);
    }

    @Test
    @DisplayName("borne les valeurs hors intervalle")
    void clampsOutOfRangeValues() {
        CohereClient.ScoreBreakdown breakdown = client.parseScores(
                "{\"technique\": 150, \"communication\": -5, \"seniorite\": 60}");

        assertThat(breakdown.technical).isEqualTo(100);
        assertThat(breakdown.communication).isEqualTo(0);
    }

    @Test
    @DisplayName("refuse une réponse où un critère manque, plutôt que de mettre une valeur par défaut")
    void refusesWhenOneCriterionIsMissing() {
        assertThatThrownBy(() -> client.parseScores("{\"technique\": 84, \"communication\": 61}"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non conforme");
    }

    @Test
    @DisplayName("refuse une réponse aux clés inattendues, sans reprendre les nombres dans l'ordre")
    void refusesUnexpectedKeys() {
        // L'ancien repli aurait lu 2019, 84 et 61 comme les trois critères.
        assertThatThrownBy(() -> client.parseScores(
                "{\"analyse\": \"2019\", \"score\": 84, \"detaux\": 61}"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("tolère le texte qui entoure l'objet JSON")
    void toleratesSurroundingText() {
        CohereClient.ScoreBreakdown breakdown = client.parseScores(
                "Voici mon évaluation : {\"technique\": 77, \"communication\": 66, \"seniorite\": 55} Bonne journée.");

        assertThat(breakdown.technical).isEqualTo(77);
    }

    @Test
    @DisplayName("refuse une réponse sans objet JSON")
    void refusesWithoutJson() {
        assertThatThrownBy(() -> client.parseScores("Le candidat est très bon."))
                .isInstanceOf(IllegalStateException.class);
    }
}
