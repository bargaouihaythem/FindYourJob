package com.recrutement.app.dto;

import com.recrutement.app.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Option du sélecteur « manager recruteur » du formulaire d'offre : ce dont le RH a
 * besoin pour désigner le destinataire, sans exposer le compte complet.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManagerOptionResponse {

    private Long id;
    private String fullName;
    private String email;
    private Long departmentId;
    private String departmentName;

    public ManagerOptionResponse(User user) {
        this.id = user.getId();
        String name = (user.getFirstName() == null ? "" : user.getFirstName())
                + " " + (user.getLastName() == null ? "" : user.getLastName());
        this.fullName = name.trim().isEmpty() ? user.getUsername() : name.trim();
        this.email = user.getEmail();
        this.departmentId = user.getDepartment() != null ? user.getDepartment().getId() : null;
        this.departmentName = user.getDepartment() != null ? user.getDepartment().getName() : null;
    }
}
