package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Vérifications d'autorisation transverses pour les données candidat et CV.
 */
@Service
public class AccessControlService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Vérifie qu'un candidat simple ne consulte que ses propres candidatures.
     * Les rôles internes disposent d'un contrôle métier séparé selon leur périmètre.
     */
    public void assertOwnEmailOrPrivileged(String requestedEmail) {
        Authentication authentication = currentAuthentication();
        if (authentication == null) {
            return;
        }

        User currentUser = findCurrentUser(authentication);
        if (currentUser == null || hasRole(currentUser, Role.ERole.ROLE_HR)
                || hasRole(currentUser, Role.ERole.ROLE_ADMIN)
                || hasRole(currentUser, Role.ERole.ROLE_MANAGER)) {
            return;
        }

        if (currentUser.getEmail() == null || requestedEmail == null
                || !currentUser.getEmail().equalsIgnoreCase(requestedEmail)) {
            throw new AccessDeniedException("Vous ne pouvez consulter que vos propres données");
        }
    }

    public boolean canAccessCandidate(Candidate candidate) {
        try {
            assertCanAccessCandidate(candidate);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    /**
     * Autorise l'accès aux métadonnées ou au fichier d'un candidat précis.
     * Un candidat ne peut accéder qu'à son propre dossier ; un manager doit
     * appartenir au périmètre de l'offre ; RH/Admin disposent d'un accès global.
     */
    public void assertCanAccessCandidate(Candidate candidate) {
        if (candidate == null) {
            throw new AccessDeniedException("Candidat introuvable");
        }

        Authentication authentication = currentAuthentication();
        User currentUser = authentication != null ? findCurrentUser(authentication) : null;
        if (currentUser == null) {
            throw new AccessDeniedException("Authentification requise");
        }

        if (hasRole(currentUser, Role.ERole.ROLE_HR)
                || hasRole(currentUser, Role.ERole.ROLE_ADMIN)) {
            return;
        }

        if (hasRole(currentUser, Role.ERole.ROLE_MANAGER)) {
            if (isInManagerScope(candidate.getJobOffer(), currentUser)) {
                return;
            }
            throw new AccessDeniedException("Le candidat ne fait pas partie de votre périmètre");
        }

        boolean technicalReader = hasRole(currentUser, Role.ERole.ROLE_TEAM_LEAD)
                || hasRole(currentUser, Role.ERole.ROLE_SENIOR_DEV)
                || hasRole(currentUser, Role.ERole.ROLE_TEAM);
        if (technicalReader && sameDepartment(candidate.getJobOffer(), currentUser)) {
            return;
        }

        if (hasRole(currentUser, Role.ERole.ROLE_USER)
                && currentUser.getEmail() != null
                && candidate.getEmail() != null
                && currentUser.getEmail().equalsIgnoreCase(candidate.getEmail())) {
            return;
        }

        // Les rôles techniques en lecture ne sont admis que sur les dossiers
        // transmis à leur périmètre via les endpoints manager dédiés. Un accès
        // direct par nom de fichier ne doit jamais contourner ce contrôle.
        throw new AccessDeniedException("Vous n'êtes pas autorisé à accéder à ce dossier");
    }

    private Authentication currentAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }
        return authentication;
    }

    private User findCurrentUser(Authentication authentication) {
        return userRepository.findByUsername(authentication.getName()).orElse(null);
    }

    private boolean hasRole(User user, Role.ERole role) {
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(currentRole -> currentRole.getName() == role);
    }

    private boolean sameDepartment(JobOffer jobOffer, User user) {
        return jobOffer != null && jobOffer.getDepartment() != null
                && user.getDepartment() != null
                && jobOffer.getDepartment().getId().equals(user.getDepartment().getId());
    }

    private boolean isInManagerScope(JobOffer jobOffer, User manager) {
        boolean ownsByEmail = jobOffer != null && jobOffer.getManagerEmail() != null
                && manager.getEmail() != null
                && jobOffer.getManagerEmail().equalsIgnoreCase(manager.getEmail());
        boolean ownsByDepartment = jobOffer != null && jobOffer.getDepartment() != null
                && manager.getDepartment() != null
                && jobOffer.getDepartment().getId().equals(manager.getDepartment().getId());
        boolean ownsByJobFamily = jobOffer != null && jobOffer.getJobFamily() != null
                && manager.getJobFamily() != null
                && jobOffer.getJobFamily() == manager.getJobFamily();
        return ownsByEmail || ownsByDepartment || ownsByJobFamily;
    }
}
