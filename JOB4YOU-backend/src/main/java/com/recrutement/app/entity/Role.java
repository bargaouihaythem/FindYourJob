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
    /**
     * Mapping des rôles métier :
     *
     *  ROLE_USER       → Candidat  : consulter offres, postuler, suivre sa candidature
     *  ROLE_HR         → RH        : gérer offres, valider dossiers administratifs, envoyer réponses finales
     *  ROLE_MANAGER    → Manager   : consulter dossiers validés, feedback technique, valider/refuser
     *  ROLE_ADMIN      → Admin     : gestion utilisateurs, rôles, supervision globale
     *  ROLE_TEAM_LEAD  → Tech Lead : lecture entretiens et CV (pas de modification)
     *  ROLE_SENIOR_DEV → Senior    : lecture entretiens et CV (pas de modification)
     *  ROLE_TEAM       → Équipe    : lecture entretiens et CV (pas de modification)
     *
     *  Note : ROLE_USER correspond au rôle "Candidat" dans le processus métier.
     */
    public enum ERole {
        ROLE_USER,       // Candidat : postuler, consulter offres, suivre statut candidature
        ROLE_HR,         // RH       : validation administrative, gestion offres, réponse finale
        ROLE_MANAGER,    // Manager  : validation technique, feedback, demande entretien
        ROLE_ADMIN,      // Admin    : supervision globale, gestion utilisateurs et rôles
        ROLE_TEAM_LEAD,  // Tech Lead   : lecture seule (entretiens, CV)
        ROLE_SENIOR_DEV, // Senior Dev  : lecture seule (entretiens, CV)
        ROLE_TEAM        // Équipe      : lecture seule (entretiens, CV)
    }
}

