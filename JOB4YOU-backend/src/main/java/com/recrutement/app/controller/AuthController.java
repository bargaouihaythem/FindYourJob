package com.recrutement.app.controller;

import com.recrutement.app.dto.JwtResponse;
import com.recrutement.app.dto.LoginRequest;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.dto.SignupRequest;
import com.recrutement.app.dto.ForgotPasswordRequest;
import com.recrutement.app.dto.ResetPasswordRequest;
import com.recrutement.app.service.PasswordResetService;
import com.recrutement.app.service.RateLimitService;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.RoleRepository;
import com.recrutement.app.repository.UserRepository;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.services.UserPrinciple;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Duration;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;


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
    RateLimitService rateLimitService;

    @PostMapping("/signin")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest,
                                               HttpServletRequest request) {
        String remoteAddress = request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
        String rateKey = "login:" + remoteAddress + ":" + loginRequest.getUsername().toLowerCase(java.util.Locale.ROOT);
        if (!rateLimitService.allow(rateKey, 10, Duration.ofMinutes(15))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new MessageResponse("Trop de tentatives. Réessayez plus tard."));
        }

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

        // Inscription publique : toujours ROLE_USER (candidat), quoi que le client envoie.
        // L'attribution de rôles internes (HR/MANAGER/ADMIN/...) se fait exclusivement
        // via PATCH /api/users/{id}/roles (Admin uniquement, cf. UserController) — jamais
        // depuis cet endpoint public, pour éviter qu'un visiteur s'auto-déclare admin.
        Role userRole = roleRepository.findByName(Role.ERole.ROLE_USER)
                .orElseThrow(() -> new RuntimeException("Error: Role is not found."));
        user.setRoles(new HashSet<>(Set.of(userRole)));
        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        // Réponse identique que le compte existe ou non afin d’éviter
        // l’énumération des utilisateurs.
        passwordResetService.sendPasswordResetCode(request.getEmail());
        return ResponseEntity.ok(new MessageResponse(
                "Si un compte correspond à cette adresse, un code de réinitialisation sera envoyé"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            boolean success = passwordResetService.resetPassword(request.getResetCode(), request.getNewPassword());
            if (success) {
                return ResponseEntity.ok(new MessageResponse("Mot de passe réinitialisé avec succès"));
            }
            return ResponseEntity.badRequest().body(new MessageResponse("Code invalide ou expiré"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur lors de la réinitialisation du mot de passe"));
        }
    }
}

