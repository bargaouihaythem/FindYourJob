package com.recrutement.app.service;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Détermine le manager destinataire d'un dossier candidat validé par le RH.
 *
 * Priorité : un manager enregistré pour la famille de métier de l'offre
 * (User.jobFamily) est choisi automatiquement ; à défaut, on retombe sur le
 * champ JobOffer.managerEmail saisi manuellement par le RH (comportement
 * historique, conservé comme filet de sécurité).
 */
@Service
public class ManagerRoutingService {

    @Autowired
    private UserRepository userRepository;

    public String resolveManagerEmail(JobOffer jobOffer) {
        if (jobOffer == null) {
            return null;
        }

        if (jobOffer.getJobFamily() != null) {
            List<User> managers = userRepository.findManagersByJobFamily(
                    jobOffer.getJobFamily(), Role.ERole.ROLE_MANAGER);
            if (!managers.isEmpty()) {
                return managers.get(0).getEmail();
            }
        }

        return jobOffer.getManagerEmail();
    }
}
