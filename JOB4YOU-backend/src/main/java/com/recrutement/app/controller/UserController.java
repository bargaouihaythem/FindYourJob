package com.recrutement.app.controller;

import com.recrutement.app.dto.UserResponse;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "API pour la gestion des utilisateurs")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/interviewers")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer tous les utilisateurs pouvant être des interviewers")
    public ResponseEntity<List<UserResponse>> getInterviewers() {
        // Récupérer tous les utilisateurs qui ont des rôles d'interviewer potentiels
        List<User> interviewers = userRepository.findAll().stream()
                .filter(user -> user.getRoles().stream()
                        .anyMatch(role -> 
                            role.getName() == Role.ERole.ROLE_HR ||
                            role.getName() == Role.ERole.ROLE_MANAGER ||
                            role.getName() == Role.ERole.ROLE_ADMIN ||
                            role.getName() == Role.ERole.ROLE_TEAM_LEAD ||
                            role.getName() == Role.ERole.ROLE_SENIOR_DEV ||
                            role.getName() == Role.ERole.ROLE_TEAM
                        )
                )
                .collect(Collectors.toList());
        
        List<UserResponse> response = interviewers.stream()
                .map(UserResponse::new)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Récupérer tous les utilisateurs (Admin uniquement)")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<UserResponse> response = userRepository.findAll().stream()
                .map(UserResponse::new)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer un utilisateur par ID")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé avec l'ID: " + id));
        
        return ResponseEntity.ok(new UserResponse(user));
    }

    @PostMapping("/test/create-sample-users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer des utilisateurs de test (ADMIN uniquement)")
    public ResponseEntity<String> createSampleUsers() {
        try {
            // Vérifier et créer un manager de test
            if (!userRepository.existsByEmail("manager.test@company.com")) {
                User manager = new User();
                manager.setUsername("manager_test");
                manager.setEmail("manager.test@company.com");
                manager.setPassword("$2a$10$placeholder"); // Hash de mot de passe placeholder
                manager.setFirstName("Jean-Claude");
                manager.setLastName("Manager");
                
                // Note: Les rôles doivent être assignés par l'endpoint d'inscription
                // ou par une méthode dédiée qui gère les relations avec la table des rôles
                
                userRepository.save(manager);
                System.out.println("Manager créé: " + manager.getEmail());
            }

            // Vérifier et créer un HR de test
            if (!userRepository.existsByEmail("hr.test@company.com")) {
                User hr = new User();
                hr.setUsername("hr_test");
                hr.setEmail("hr.test@company.com");
                hr.setPassword("$2a$10$placeholder");
                hr.setFirstName("Marie");
                hr.setLastName("RH");
                
                userRepository.save(hr);
                System.out.println("HR créé: " + hr.getEmail());
            }

            return ResponseEntity.ok("Utilisateurs de test créés avec succès! Note: Les rôles doivent être assignés manuellement.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erreur lors de la création: " + e.getMessage());
        }
    }
}
