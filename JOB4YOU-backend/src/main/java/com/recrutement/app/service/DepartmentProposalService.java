package com.recrutement.app.service;

import com.recrutement.app.entity.Department;
import com.recrutement.app.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Propose un département pour une offre qui n'en a pas, à partir de son titre et de
 * ses compétences requises.
 *
 * La vérification est lexicale et déterministe : mots du libellé du département et
 * alias convenus, comparés aux mots du texte de l'offre. Pas d'embeddings ni de
 * similarité vectorielle — une proposition doit rester explicable et reproductible.
 *
 * Ce service ne décide rien : il éclaire le RH, qui confirme (ou corrige) avant que
 * l'offre ne soit rattachée. L'aiguillage effectif reste la chaîne structurelle de
 * ManagerRoutingService.
 */
@Service
public class DepartmentProposalService {

    /** Nombre minimal de propositions renvoyées, même peu pertinentes. */
    private static final int MAX_PROPOSALS = 3;

    /** Alias department code → vocabulaire qui le désigne dans un intitulé de poste. */
    private static final Set<String> NOISE_WORDS = Set.of(
            "pour", "par", "sur", "avec", "sans", "les", "des", "une", "un", "the", "and",
            "poste", "profil", "recherche", "offre", "mission", "niveau", "ans", "an",
            "junior", "senior", "mid", "stage", "cdi", "cdd", "alternance", "temps", "plein");

    @Autowired
    private DepartmentRepository departmentRepository;

    /** Une proposition : le département, le score de recoupement et les mots qui l'ont produite. */
    public record Proposal(Long departmentId, String departmentName, String departmentCode,
                           int score, List<String> matchedTerms) {
    }

    /**
     * @param title          titre de l'offre
     * @param requiredSkills compétences requises, texte libre
     * @return jusqu'à 3 départements classés par score décroissant ; vide si aucun
     *         recoupement — le RH doit alors choisir à la main.
     */
    public List<Proposal> propose(String title, String requiredSkills) {
        String haystack = tokenize(title + " " + requiredSkills);
        if (haystack.isEmpty()) {
            return List.of();
        }

        return departmentRepository.findAll().stream()
                .map(department -> score(department, haystack))
                .filter(proposal -> proposal.score() > 0)
                .sorted(Comparator.comparingInt(Proposal::score).reversed())
                .limit(MAX_PROPOSALS)
                .collect(Collectors.toList());
    }

    private Proposal score(Department department, String haystack) {
        List<String> terms = vocabulary(department);
        List<String> matched = terms.stream()
                .filter(term -> !term.isBlank() && haystack.contains(" " + term + " "))
                .distinct()
                .collect(Collectors.toList());
        // Le libellé complet ("Recherche & Developpement") vaut plus qu'un mot isolé.
        int score = matched.size();
        String fullName = normalize(department.getName());
        if (!fullName.isBlank() && haystack.contains(" " + fullName + " ")) {
            score += 2;
        }
        return new Proposal(department.getId(), department.getName(), department.getCode(),
                score, matched);
    }

    private List<String> vocabulary(Department department) {
        return java.util.stream.Stream.concat(
                        List.of(department.getName(), department.getCode()).stream(),
                        Aliases.forCode(department.getCode()).stream())
                .map(this::normalize)
                .filter(term -> !term.isEmpty())
                .collect(Collectors.toList());
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return withoutAccents.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9&+ ]", " ")
                .replaceAll("\\s+", " ").trim();
    }

    /** Texte découpé en mots encadrés d'espaces, pour des comparaisons entières. */
    private String tokenize(String text) {
        String normalized = normalize(text);
        if (normalized.isEmpty()) {
            return "";
        }
        String kept = java.util.Arrays.stream(normalized.split(" "))
                .filter(word -> word.length() > 2 && !NOISE_WORDS.contains(word)
                        && !word.matches("\\d+"))
                .collect(Collectors.joining(" "));
        return kept.isEmpty() ? "" : " " + kept + " ";
    }

    /** Alias métier des codes de département initialisés ; vide pour un code inconnu. */
    private static final class Aliases {
        private static final java.util.Map<String, List<String>> BY_CODE = java.util.Map.of(
                "QA", List.of("test", "tests", "quality", "assurance", "automate", "automatisation"),
                "DEVOPS", List.of("devops", "platforme", "infrastructure", "sre", "cloud"),
                "R&D", List.of("developpement", "innovation", "etudes"),
                "PRODOPS", List.of("product", "produit", "productops", "operations"),
                "HRACCESS", List.of("hraccess", "hr", "humaines", "recrutement"));

        static List<String> forCode(String code) {
            if (code == null) {
                return List.of();
            }
            return BY_CODE.getOrDefault(code.toUpperCase(Locale.ROOT), List.of());
        }
    }
}
