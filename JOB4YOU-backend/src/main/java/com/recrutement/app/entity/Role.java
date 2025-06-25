package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "roles")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, unique = true, nullable = false)
    private ERole name;

    public Role(ERole name) {
        this.name = name;
    }

    // Enum pour les différents types de rôles
    public enum ERole {
        ROLE_USER,       // Utilisateur standard/Candidats
        ROLE_HR,         // Ressources Humaines
        ROLE_MANAGER,    // Manager d'équipe
        ROLE_ADMIN,      // Administrateur
        ROLE_TEAM_LEAD,  // Chef d'équipe technique
        ROLE_SENIOR_DEV, // Développeur senior
        ROLE_TEAM        // Membre d'équipe générique
    }
}

