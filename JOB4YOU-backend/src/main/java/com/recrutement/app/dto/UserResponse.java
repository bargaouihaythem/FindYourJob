package com.recrutement.app.dto;

import com.recrutement.app.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private List<String> roles;
    private String displayName;

    // Constructeur pour mapper depuis l'entité User
    public UserResponse(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.roles = user.getRoles().stream()
                .map(role -> role.getName().name())
                .collect(Collectors.toList());
        this.displayName = generateDisplayName(user);
    }

    private String generateDisplayName(User user) {
        StringBuilder display = new StringBuilder();
        
        if (user.getFirstName() != null && user.getLastName() != null) {
            display.append(user.getFirstName()).append(" ").append(user.getLastName());
        } else {
            display.append(user.getUsername());
        }
        
        // Ajouter le rôle principal (plus élevé)
        String mainRole = getMainRoleDisplay(user);
        if (mainRole != null) {
            display.append(" - ").append(mainRole);
        }
        
        return display.toString();
    }

    private String getMainRoleDisplay(User user) {
        // Priorité des rôles (du plus élevé au plus bas)
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_ADMIN"))) {
            return "Administrateur";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_HR"))) {
            return "RH Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_MANAGER"))) {
            return "Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_TEAM_LEAD"))) {
            return "Tech Lead";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_SENIOR_DEV"))) {
            return "Senior Developer";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName().name().equals("ROLE_TEAM"))) {
            return "Équipe";
        }
        return null;
    }
}
