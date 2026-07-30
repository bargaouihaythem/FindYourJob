package com.recrutement.app.service;

import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Vérifications d'autorisation transverses, utilisées par plusieurs services
 * pour empêcher un candidat (ROLE_USER) d'accéder aux données d'un autre
 * candidat via un endpoint "by-email" en changeant simplement l'email dans
 * l'URL (IDOR).
 */
@Service
public class AccessControlService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Lève une AccessDeniedException si l'utilisateur authentifié est un
     * simple candidat (ROLE_USER, sans RH/Admin) ET que l'email demandé
     * n'est pas le sien. RH/Admin, appels anonymes (n8n) et utilisateurs
     * introuvables ne sont pas restreints par cette méthode.
     */
    public void assertOwnEmailOrPrivileged(String requestedEmail) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return;
        }

        User currentUser = userRepository.findByUsername(authentication.getName()).orElse(null);
        if (currentUser == null) {
            return;
        }

        boolean isPrivileged = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_HR
                        || r.getName() == Role.ERole.ROLE_ADMIN
                        || r.getName() == Role.ERole.ROLE_MANAGER);
        if (isPrivileged) {
            return;
        }

        if (currentUser.getEmail() == null || !currentUser.getEmail().equalsIgnoreCase(requestedEmail)) {
            throw new AccessDeniedException("Vous ne pouvez consulter que vos propres données");
        }
    }
}
