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
    private static final int CODE_LENGTH = 6;
    private static final int CODE_VALIDITY_HOURS = 1;
    
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
     * Génère et envoie un code de réinitialisation de mot de passe
     */
    @Transactional
    public boolean sendPasswordResetCode(String email) {
        try {
            logger.info("Début de sendPasswordResetCode pour l'email: {}", email);
            
            // Vérifier si l'utilisateur existe
            Optional<User> userOpt = userRepository.findByEmail(email);
            if (userOpt.isEmpty()) {
                logger.warn("Tentative de réinitialisation pour un email inexistant: {}", email);
                return false;
            }
            
            User user = userOpt.get();
            logger.info("Utilisateur trouvé: {}", user.getUsername());
            
            // Invalider tous les codes précédents pour cet email
            logger.info("Invalidation des codes précédents pour: {}", email);
            passwordResetTokenRepository.markAllAsUsedByEmail(email);
            
            // Générer un nouveau code
            String resetCode = generateResetCode();
            logger.info("Code généré: {}", resetCode);
            
            // Créer le token
            PasswordResetToken token = new PasswordResetToken(
                resetCode, 
                email, 
                LocalDateTime.now().plusHours(CODE_VALIDITY_HOURS)
            );
            
            logger.info("Sauvegarde du token en base");
            passwordResetTokenRepository.save(token);
            
            // Envoyer l'email
            logger.info("Envoi de l'email");
            sendResetCodeEmail(user, resetCode);
            
            // Pour le développement : afficher le code dans les logs
            logger.warn("🔑 CODE DE RÉINITIALISATION POUR {} : {}", email, resetCode);
            logger.warn("🔑 Ce code est valide pendant {} heure(s)", CODE_VALIDITY_HOURS);
            
            logger.info("Code de réinitialisation envoyé avec succès pour l'email: {}", email);
            return true;
            
        } catch (Exception e) {
            logger.error("Erreur lors de l'envoi du code de réinitialisation pour l'email: {}", email, e);
            return false;
        }
    }
    
    /**
     * Valide un code de réinitialisation et change le mot de passe
     */
    @Transactional
    public boolean resetPassword(String resetCode, String newPassword) {
        try {
            // Trouver le token
            Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository.findByResetCodeAndUsedFalse(resetCode);
            if (tokenOpt.isEmpty()) {
                logger.warn("Code de réinitialisation invalide ou déjà utilisé: {}", resetCode);
                return false;
            }
            
            PasswordResetToken token = tokenOpt.get();
            
            // Vérifier l'expiration
            if (token.isExpired()) {
                logger.warn("Code de réinitialisation expiré: {}", resetCode);
                return false;
            }
            
            // Trouver l'utilisateur
            Optional<User> userOpt = userRepository.findByEmail(token.getEmail());
            if (userOpt.isEmpty()) {
                logger.error("Utilisateur non trouvé pour l'email: {}", token.getEmail());
                return false;
            }
            
            User user = userOpt.get();
            
            // Changer le mot de passe
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);
            
            // Marquer le token comme utilisé
            token.setUsed(true);
            passwordResetTokenRepository.save(token);
            
            // Invalider tous les autres codes pour cet email
            passwordResetTokenRepository.markAllAsUsedByEmail(token.getEmail());
            
            logger.info("Mot de passe réinitialisé avec succès pour l'email: {}", token.getEmail());
            return true;
            
        } catch (Exception e) {
            logger.error("Erreur lors de la réinitialisation du mot de passe avec le code: {}", resetCode, e);
            return false;
        }
    }
    
    /**
     * Génère un code de réinitialisation aléatoirement
     */
    private String generateResetCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(secureRandom.nextInt(10));
        }
        return code.toString();
    }
    
    /**
     * Envoie l'email avec le code de réinitialisation
     */
    private void sendResetCodeEmail(User user, String resetCode) {
        try {
            logger.info("Envoi du code de réinitialisation à: {}", user.getEmail());
            
            String subject = "Code de réinitialisation de votre mot de passe";
            
            Map<String, Object> variables = new HashMap<>();
            variables.put("userName", user.getFirstName() + " " + user.getLastName());
            variables.put("resetCode", resetCode);
            variables.put("validityHours", CODE_VALIDITY_HOURS);
            
            // Utilisation de la version synchrone pour les emails critiques
            emailService.sendTemplateEmailSync(
                user.getEmail(),
                subject,
                "emails/password-reset",
                variables
            );
            
            logger.info("Email de réinitialisation envoyé avec succès");
            
        } catch (Exception e) {
            logger.error("Erreur lors de l'envoi de l'email de réinitialisation à: {}", user.getEmail(), e);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        }
    }
    
    /**
     * Nettoie les tokens expirés (à appeler périodiquement)
     */
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
