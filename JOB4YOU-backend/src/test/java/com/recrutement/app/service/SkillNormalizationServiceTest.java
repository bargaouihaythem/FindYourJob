package com.recrutement.app.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link SkillNormalizationService}.
 *
 * Verrouille la règle de frontière de mot dont dépendent à la fois le scoring et le
 * pré-filtrage du matching inverse : une sous-chaîne ne doit jamais suffire à valider
 * une compétence.
 */
@DisplayName("SkillNormalizationService - Tests unitaires")
class SkillNormalizationServiceTest {

    private final SkillNormalizationService service = new SkillNormalizationService();

    @Test
    @DisplayName("« Java » ne doit pas être considéré présent quand le CV ne mentionne que JavaScript")
    void javaDoesNotMatchJavaScript() {
        assertThat(service.isSkillPresentInText("Java", "expert javascript, react et node.js")).isFalse();
        assertThat(service.isSkillPresentInText("Java", "java 17, spring boot")).isTrue();
    }

    @Test
    @DisplayName("« Angular » ne doit pas être considéré présent quand le CV ne mentionne qu'AngularJS")
    void angularDoesNotMatchAngularJs() {
        assertThat(service.isSkillPresentInText("Angular", "angularjs 1.8")).isFalse();
        assertThat(service.isSkillPresentInText("Angular", "angular 16, typescript")).isTrue();
    }

    @Test
    @DisplayName("Spring Boot et Spring Cloud restent deux compétences distinctes")
    void springBootAndSpringCloudStayDistinct() {
        assertThat(service.isSkillPresentInText("Spring Boot", "spring cloud config et gateway")).isFalse();
        assertThat(service.isSkillPresentInText("Spring Cloud", "spring boot 3")).isFalse();
    }

    @Test
    @DisplayName("Les alias d'usage sont reconnus (k8s, postgres)")
    void recognizesCommonAliases() {
        assertThat(service.isSkillPresentInText("Kubernetes", "mise en production sur k8s")).isTrue();
        assertThat(service.isSkillPresentInText("PostgreSQL", "postgres en base principale")).isTrue();
    }

    @Test
    @DisplayName("Les années d'expérience sont lues avec l'apostrophe typographique des CV Word et PDF")
    void extractsYearsWithTypographicApostrophe() {
        assertThat(service.extractExperienceYears("10 ans d’expérience en banque")).isEqualTo(10);
        assertThat(service.extractExperienceYears("10 ans d'expérience en banque")).isEqualTo(10);
    }

    @Test
    @DisplayName("Les versions d'outils ne sont pas prises pour des années d'expérience")
    void doesNotReadToolVersionsAsYears() {
        // « Java 17 » seul ne doit pas produire 17 années ; le garde-fou renvoie null
        // puis l'autre variante, plus récente, est ignorée par la borne haute.
        assertThat(service.extractExperienceYears("java 17 et angular 16")).isNull();
    }

    @Test
    @DisplayName("Un libellé de compétence inconnu est capitalisé, pas dénaturé")
    void normalizesKnownAndUnknownSkills() {
        assertThat(service.normalizeSkill("k8s")).isEqualTo("Kubernetes");
        assertThat(service.normalizeSkill("cobol java mainframe")).isEqualTo("Cobol Java Mainframe");
    }

    @Test
    @DisplayName("Une compétence niée n'est pas comptée comme acquise")
    void negatedSkillIsNotCountedAsPresent() {
        String cv = "n'a pas encore manipulé kubernetes ni les clouds publics aws/gcp en production";
        assertThat(service.isSkillPresentInText("Kubernetes", cv)).isFalse();
        assertThat(service.isSkillPresentInText("AWS", cv)).isFalse();
        assertThat(service.isSkillPresentInText("GCP", cv)).isFalse();

        assertThat(service.isSkillPresentInText("Docker", "aucune expérience docker, je découvre")).isFalse();
        assertThat(service.isSkillPresentInText("Docker", "maîtrise docker et aws")).isTrue();
    }

    @Test
    @DisplayName("La portée d'une négation s'arrête à la ponctuation et ne remonte pas après la compétence")
    void negationScopeStopsAtPunctuation() {
        // La négation ne gouverne que ce qui la suit dans le même segment.
        assertThat(service.isSkillPresentInText("Spring Boot", "spring boot et je n'ai pas azure")).isTrue();
        assertThat(service.isSkillPresentInText("Azure", "spring boot et je n'ai pas azure")).isFalse();
        // Les deux-points bornent la portée, sinon une liste entière serait effacée par le « sans » initial.
        assertThat(service.isSkillPresentInText("Java", "sans gestion d'équipe : java, spring boot")).isTrue();
        // « jamais » nié, puis reprise après virgule.
        assertThat(service.isSkillPresentInText("Kubernetes", "n'a jamais fait de docker, ni de kubernetes")).isFalse();
    }
}
