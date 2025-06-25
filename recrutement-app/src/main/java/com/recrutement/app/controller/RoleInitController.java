package com.recrutement.app.controller;

import com.recrutement.app.entity.Role;
import com.recrutement.app.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/init")
public class RoleInitController {

    @Autowired
    private RoleRepository roleRepository;

    @PostMapping("/roles")
    public ResponseEntity<?> initRoles() {
        try {
            // Vérifier et créer tous les rôles nécessaires
            for (Role.ERole roleEnum : Role.ERole.values()) {
                if (roleRepository.findByName(roleEnum).isEmpty()) {
                    Role role = new Role(roleEnum);
                    roleRepository.save(role);
                    System.out.println("Rôle créé: " + roleEnum);
                } else {
                    System.out.println("Rôle existe déjà: " + roleEnum);
                }
            }
            return ResponseEntity.ok("Tous les rôles ont été initialisés avec succès!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erreur lors de l'initialisation des rôles: " + e.getMessage());
        }
    }

    @GetMapping("/roles")
    public ResponseEntity<?> getAllRoles() {
        return ResponseEntity.ok(roleRepository.findAll());
    }
}
