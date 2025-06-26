package com.recrutement.app.controller;

import com.recrutement.app.dto.JwtResponse;
import com.recrutement.app.dto.LoginRequest;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.dto.SignupRequest;
import com.recrutement.app.dto.ForgotPasswordRequest;
import com.recrutement.app.dto.ResetPasswordRequest;
import com.recrutement.app.service.PasswordResetService;
import com.recrutement.app.service.EmailService;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.RoleRepository;
import com.recrutement.app.repository.UserRepository;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.services.UserPrinciple;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    RoleRepository roleRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    PasswordResetService passwordResetService;

    @Autowired
    EmailService emailService;

    public AuthController() {
        System.out.println("=== AuthController créé ===");
    }

    @PostMapping("/signin")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken(authentication);

        UserPrinciple userDetails = (UserPrinciple) authentication.getPrincipal();
        List<String> roles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        return ResponseEntity.ok(new JwtResponse(jwt,
                userDetails.getId(),
                userDetails.getUsername(),
                userDetails.getEmail(),
                roles));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Username is already taken!"));
        }

        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Email is already in use!"));
        }

        // Create new user's account
        User user = new User(signUpRequest.getUsername(),
                signUpRequest.getEmail(),
                encoder.encode(signUpRequest.getPassword()));

        user.setFirstName(signUpRequest.getFirstName());
        user.setLastName(signUpRequest.getLastName());

        Set<String> strRoles = signUpRequest.getRole();
        Set<Role> roles = new HashSet<>();

        if (strRoles == null) {
            Role userRole = roleRepository.findByName(Role.ERole.ROLE_USER)
                    .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
            roles.add(userRole);
        } else {
            strRoles.forEach(role -> {
                switch (role) {
                    case "admin":
                        Role adminRole = roleRepository.findByName(Role.ERole.ROLE_ADMIN)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(adminRole);
                        break;
                    case "hr":
                        Role hrRole = roleRepository.findByName(Role.ERole.ROLE_HR)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(hrRole);
                        break;
                    case "manager":
                        Role managerRole = roleRepository.findByName(Role.ERole.ROLE_MANAGER)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(managerRole);
                        break;
                    case "team_lead":
                        Role teamLeadRole = roleRepository.findByName(Role.ERole.ROLE_TEAM_LEAD)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(teamLeadRole);
                        break;
                    case "senior_dev":
                        Role seniorDevRole = roleRepository.findByName(Role.ERole.ROLE_SENIOR_DEV)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(seniorDevRole);
                        break;
                    case "team":
                        Role teamRole = roleRepository.findByName(Role.ERole.ROLE_TEAM)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(teamRole);
                        break;
                    default:
                        Role userRole = roleRepository.findByName(Role.ERole.ROLE_USER)
                                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
                        roles.add(userRole);
                }
            });
        }

        user.setRoles(roles);
        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @GetMapping("/test")
    public ResponseEntity<?> test() {
        System.out.println("=== ENDPOINT TEST APPELÉ ===");
        return ResponseEntity.ok(new MessageResponse("Test endpoint fonctionne"));
    }

    @PostMapping("/test-email")
    public ResponseEntity<?> testEmail(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Email requis"));
            }
            
            System.out.println("=== TEST EMAIL SIMPLE ===");
            System.out.println("Envoi d'email de test vers: " + email);
            
            emailService.sendSimpleEmailSync(
                email, 
                "Test Email - Job4You", 
                "Ceci est un email de test pour vérifier la configuration email. Si vous recevez ceci, la configuration fonctionne !"
            );
            
            System.out.println("Email de test envoyé !");
            return ResponseEntity.ok(new MessageResponse("Email de test envoyé vers: " + email));
        } catch (Exception e) {
            System.out.println("Erreur lors de l'envoi de l'email de test: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur: " + e.getMessage()));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        System.out.println("=== DEBUT forgotPassword ===");
        System.out.println("Email reçu: " + (request != null ? request.getEmail() : "request null"));
        
        if (request == null || request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            System.out.println("Email manquant ou invalide !");
            return ResponseEntity.badRequest()
                .body(new MessageResponse("Email requis"));
        }
        
        try {
            System.out.println("Demande de réinitialisation pour l'email: " + request.getEmail());
            boolean success = passwordResetService.sendPasswordResetCode(request.getEmail());
            
            if (success) {
                System.out.println("Code envoyé avec succès pour: " + request.getEmail());
                return ResponseEntity.ok(new MessageResponse("Code de réinitialisation envoyé par email"));
            } else {
                System.out.println("Échec de l'envoi du code pour: " + request.getEmail());
                return ResponseEntity.badRequest()
                    .body(new MessageResponse("Utilisateur non trouvé ou erreur lors de l'envoi"));
            }
        } catch (Exception e) {
            System.out.println("Exception lors de l'envoi du code: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest()
                .body(new MessageResponse("Erreur lors de l'envoi du code de réinitialisation"));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            System.out.println("=== DEBUT resetPassword ===");
            System.out.println("Code reçu: " + request.getResetCode());
            
            boolean success = passwordResetService.resetPassword(request.getResetCode(), request.getNewPassword());
            
            if (success) {
                System.out.println("Mot de passe réinitialisé avec succès");
                return ResponseEntity.ok(new MessageResponse("Mot de passe réinitialisé avec succès"));
            } else {
                System.out.println("Code invalide ou expiré");
                return ResponseEntity.badRequest()
                    .body(new MessageResponse("Code invalide ou expiré"));
            }
        } catch (Exception e) {
            System.out.println("Exception lors de la réinitialisation: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest()
                .body(new MessageResponse("Erreur lors de la réinitialisation du mot de passe"));
        }
    }
}

