package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Détermine le(s) manager(s) destinataire(s) d'un dossier candidat validé par le RH.
 *
 * Priorité : tous les managers enregistrés pour la famille de métier de l'offre
 * (User.jobFamily) sont notifiés automatiquement ; à défaut, on retombe sur le
 * champ JobOffer.managerEmail saisi manuellement par le RH (comportement
 * historique, conservé comme filet de sécurité).
 */
@Service
public class ManagerRoutingService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Retourne l'ensemble des managers à notifier pour cette offre : tous ceux
     * dont la famille de métier correspond, ou à défaut le manager saisi
     * manuellement sur l'offre. Ne retourne jamais une liste avec des doublons.
     */
    public List<String> resolveManagerEmails(JobOffer jobOffer) {
        if (jobOffer == null) {
            return Collections.emptyList();
        }

        if (jobOffer.getJobFamily() != null) {
            List<User> managers = userRepository.findManagersByJobFamily(
                    jobOffer.getJobFamily(), Role.ERole.ROLE_MANAGER);
            if (!managers.isEmpty()) {
                return managers.stream()
                        .map(User::getEmail)
                        .distinct()
                        .collect(Collectors.toList());
            }
        }

        return jobOffer.getManagerEmail() != null
                ? List.of(jobOffer.getManagerEmail())
                : Collections.emptyList();
    }
}
