package com.recrutement.app.service;

import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Récupère la liste des interviewers (utilisateurs pouvant mener des entretiens)
     */
    public List<Map<String, Object>> getInterviewers() {
        System.out.println("[DEBUG] Récupération de la liste des interviewers...");
        
        // Récupérer tous les utilisateurs qui ont des rôles d'interviewer potentiels
        List<User> allUsers = userRepository.findAll();
        System.out.println("[DEBUG] Nombre total d'utilisateurs: " + allUsers.size());
        
        List<User> interviewers = allUsers.stream()
                .filter(user -> {
                    System.out.println("[DEBUG] Utilisateur: " + user.getUsername() + " - Rôles: " + 
                        user.getRoles().stream().map(role -> role.getName().name()).toList());
                    return user.getRoles().stream()
                            .anyMatch(role -> 
                                role.getName() == Role.ERole.ROLE_HR ||
                                role.getName() == Role.ERole.ROLE_MANAGER ||
                                role.getName() == Role.ERole.ROLE_ADMIN ||
                                role.getName() == Role.ERole.ROLE_TEAM_LEAD ||
                                role.getName() == Role.ERole.ROLE_SENIOR_DEV ||
                                role.getName() == Role.ERole.ROLE_TEAM
                            );
                })
                .collect(Collectors.toList());
        
        System.out.println("[DEBUG] Nombre d'interviewers trouvés: " + interviewers.size());
        
        List<Map<String, Object>> result = interviewers.stream()
                .map(this::mapUserToInterviewerResponse)
                .collect(Collectors.toList());
        
        System.out.println("[DEBUG] Résultat final: " + result);
        return result;
    }

    /**
     * Mappe un utilisateur vers un format de réponse pour les interviewers
     */
    private Map<String, Object> mapUserToInterviewerResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("name", generateDisplayName(user));
        response.put("role", getMainRoleDisplay(user));
        response.put("email", user.getEmail());
        return response;
    }

    /**
     * Génère le nom d'affichage pour un utilisateur
     */
    private String generateDisplayName(User user) {
        if (user.getFirstName() != null && user.getLastName() != null) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return user.getUsername();
    }

    /**
     * Récupère le rôle principal d'affichage pour un utilisateur
     */
    private String getMainRoleDisplay(User user) {
        // Priorité des rôles (du plus élevé au plus bas)
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_ADMIN)) {
            return "Administrateur";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_HR)) {
            return "RH Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_MANAGER)) {
            return "Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_TEAM_LEAD)) {
            return "Tech Lead";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_SENIOR_DEV)) {
            return "Senior Developer";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_TEAM)) {
            return "Équipe";
        }
        return "Utilisateur";
    }
}
