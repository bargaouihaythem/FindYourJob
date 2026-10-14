package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Détermine le(s) manager(s) destinataire(s) d'un dossier candidat transmis par le RH.
 *
 * La résolution est exclusive, dans cet ordre, et s'arrête au premier niveau qui
 * retourne au moins un manager :
 *   1. JobOffer.hiringManager — le manager désigné par le RH sur l'offre ;
 *   2. les managers du département de l'offre ;
 *   3. à défaut de département, les managers de la famille de métier de l'offre ;
 *   4. à défaut, l'e-mail libre saisi sur JobOffer.managerEmail (filet historique).
 *
 * Rien ne sort de cette chaîne : ni le score IA, ni le contenu du CV. L'aiguillage
 * est structurel, donc déterministe et auditable ; l'IA ne fait que proposer une
 * destination au RH (DepartmentProposalService), qu'elle ne choisit jamais seule.
 */
@Service
public class ManagerRoutingService {

    @Autowired
    private UserRepository userRepository;

    /** Un destinataire résolu, prêt à afficher dans l'interface RH. */
    public record RoutedManager(Long id, String fullName, String email) {
        static RoutedManager of(User user) {
            String name = ((user.getFirstName() == null ? "" : user.getFirstName())
                    + " " + (user.getLastName() == null ? "" : user.getLastName())).trim();
            return new RoutedManager(user.getId(), name.isEmpty() ? user.getUsername() : name,
                    user.getEmail());
        }
    }

    /** Destinataires + niveau de la chaîne qui a permis de les trouver. */
    public record RoutingResult(List<RoutedManager> managers, RoutingBasis basis) {

        public static RoutingResult unresolved() {
            return new RoutingResult(Collections.emptyList(), RoutingBasis.UNRESOLVED);
        }

        public boolean isResolved() {
            return !managers.isEmpty();
        }

        public List<String> emails() {
            return managers.stream().map(RoutedManager::email).collect(Collectors.toList());
        }

        public RoutedManager primary() {
            return managers.isEmpty() ? null : managers.get(0);
        }
    }

    /**
     * Résout les managers destinataires de l'offre. Ne retourne jamais une liste
     * avec des doublons, et ne retourne jamais une adresse inventée : si aucun
     * niveau ne résout, le résultat est UNRESOLVED et l'appelant doit bloquer.
     */
    public RoutingResult resolve(JobOffer jobOffer) {
        if (jobOffer == null) {
            return RoutingResult.unresolved();
        }

        // 1) Le manager désigné sur l'offre prime : c'est une décision du RH,
        //    pas une déduction. On l'ignore seulement s'il n'est plus manager.
        User designated = jobOffer.getHiringManager();
        if (designated != null && isManager(designated) && designated.getEmail() != null) {
            return new RoutingResult(List.of(RoutedManager.of(designated)), RoutingBasis.OFFER_MANAGER);
        }

        // 2) Routage organisationnel : les managers du département de l'offre.
        if (jobOffer.getDepartment() != null && jobOffer.getDepartment().getId() != null) {
            List<RoutedManager> managers = managersOf(userRepository.findManagersByDepartment(
                    jobOffer.getDepartment().getId(), Role.ERole.ROLE_MANAGER));
            if (!managers.isEmpty()) {
                return new RoutingResult(managers, RoutingBasis.DEPARTMENT);
            }
        }

        // 3) À défaut de département, on retombe sur la famille de métier
        //    (compatibilité des offres historiques non rattachées).
        if (jobOffer.getJobFamily() != null) {
            List<RoutedManager> managers = managersOf(userRepository.findManagersByJobFamily(
                    jobOffer.getJobFamily(), Role.ERole.ROLE_MANAGER));
            if (!managers.isEmpty()) {
                return new RoutingResult(managers, RoutingBasis.JOB_FAMILY);
            }
        }

        // 4) Dernier filet : l'e-mail saisi à la main sur l'offre.
        if (jobOffer.getManagerEmail() != null && !jobOffer.getManagerEmail().isBlank()) {
            return new RoutingResult(
                    List.of(new RoutedManager(null, jobOffer.getManagerEmail(), jobOffer.getManagerEmail())),
                    RoutingBasis.LEGACY_EMAIL);
        }

        return RoutingResult.unresolved();
    }

    /**
     * Adresses des managers destinataires, sans doublon.
     * Vide si rien ne résout — l'appelant doit alors refuser la transmission.
     */
    public List<String> resolveManagerEmails(JobOffer jobOffer) {
        return resolve(jobOffer).emails();
    }

    private List<RoutedManager> managersOf(List<User> users) {
        return users.stream()
                .filter(u -> u.getEmail() != null)
                .map(RoutedManager::of)
                .distinct()
                .collect(Collectors.toList());
    }

    private boolean isManager(User user) {
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_MANAGER);
    }
}
