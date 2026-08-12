package com.recrutement.app.service;

import com.recrutement.app.entity.PasswordResetToken;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.PasswordResetTokenRepository;
import com.recrutement.app.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int CODE_LENGTH = 8;
    private static final int CODE_VALIDITY_MINUTES = 15;
    private static final int MAX_REQUESTS_PER_WINDOW = 3;
    private static final int REQUEST_WINDOW_MINUTES = 15;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Génère et envoie un code de réinitialisation. La méthode ne révèle pas
     * dans ses logs si l'adresse existe et applique une limite par adresse.
     */
    @Transactional
    public boolean sendPasswordResetCode(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (email == null) {
            return false;
        }

        LocalDateTime windowStart = LocalDateTime.now().minusMinutes(REQUEST_WINDOW_MINUTES);
        if (passwordResetTokenRepository.countByEmailAndCreatedAtAfter(email, windowStart)
                >= MAX_REQUESTS_PER_WINDOW) {
            logger.warn("Limite de demandes de réinitialisation atteinte");
            return false;
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Réponse HTTP générique côté contrôleur : ne pas permettre
            // l'énumération d'utilisateurs par différence de message.
            logger.info("Demande de réinitialisation traitée");
            return true;
        }

        try {
            User user = userOpt.get();
            passwordResetTokenRepository.markAllAsUsedByEmail(email);

            String resetCode = generateResetCode();
            PasswordResetToken token = new PasswordResetToken(
                    resetCode,
                    email,
                    LocalDateTime.now().plusMinutes(CODE_VALIDITY_MINUTES));
            passwordResetTokenRepository.save(token);

            sendResetCodeEmail(user, resetCode);
            logger.info("Demande de réinitialisation traitée");
            return true;
        } catch (Exception e) {
            logger.error("Erreur lors du traitement de la réinitialisation", e);
            return false;
        }
    }

    @Transactional
    public boolean resetPassword(String rawResetCode, String newPassword) {
        String resetCode = rawResetCode != null ? rawResetCode.trim() : "";
        if (!resetCode.matches("\\d{" + CODE_LENGTH + "}")
                || newPassword == null || newPassword.length() < 8) {
            return false;
        }

        try {
            Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository
                    .findByResetCodeAndUsedFalse(resetCode);
            if (tokenOpt.isEmpty()) {
                logger.warn("Tentative de réinitialisation avec un code invalide");
                return false;
            }

            PasswordResetToken token = tokenOpt.get();
            if (token.isExpired()) {
                logger.warn("Tentative de réinitialisation avec un code expiré");
                return false;
            }

            Optional<User> userOpt = userRepository.findByEmail(token.getEmail());
            if (userOpt.isEmpty()) {
                return false;
            }

            User user = userOpt.get();
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);

            token.setUsed(true);
            passwordResetTokenRepository.save(token);
            passwordResetTokenRepository.markAllAsUsedByEmail(token.getEmail());

            logger.info("Mot de passe réinitialisé avec succès");
            return true;
        } catch (Exception e) {
            logger.error("Erreur lors de la réinitialisation du mot de passe", e);
            return false;
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String generateResetCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(secureRandom.nextInt(10));
        }
        return code.toString();
    }

    private void sendResetCodeEmail(User user, String resetCode) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("userName", ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                + (user.getLastName() != null ? user.getLastName() : "")).trim());
        variables.put("resetCode", resetCode);
        variables.put("validityMinutes", CODE_VALIDITY_MINUTES);

        emailService.sendTemplateEmailSync(
                user.getEmail(),
                "Code de réinitialisation de votre mot de passe",
                "emails/password-reset",
                variables);
    }

    @Transactional
    public void cleanupExpiredTokens() {
        try {
            passwordResetTokenRepository.deleteExpiredTokens(LocalDateTime.now());
            logger.info("Nettoyage des tokens expirés effectué");
        } catch (Exception e) {
            logger.error("Erreur lors du nettoyage des tokens expirés", e);
        }
    }
}
