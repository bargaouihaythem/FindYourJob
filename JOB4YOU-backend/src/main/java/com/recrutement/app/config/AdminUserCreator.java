package com.recrutement.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Configuration pour créer l'utilisateur admin par défaut au démarrage
 */
@Component
@Order(2)
public class AdminUserCreator implements CommandLineRunner {    
    private static final Logger logger = LoggerFactory.getLogger(AdminUserCreator.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Value("${app.init.create-default-users:false}")
    private boolean createDefaultUsers;

    @Value("${APP_DEFAULT_ADMIN_USERNAME:admin}")
    private String defaultAdminUsername;

    @Value("${APP_DEFAULT_ADMIN_PASSWORD:}")
    private String defaultAdminPassword;

    @Value("${APP_DEFAULT_ADMIN_EMAIL:}")
    private String defaultAdminEmail;

    @Value("${APP_DEFAULT_HR_USERNAME:rh}")
    private String defaultHrUsername;

    @Value("${APP_DEFAULT_HR_PASSWORD:}")
    private String defaultHrPassword;

    @Value("${APP_DEFAULT_HR_EMAIL:}")
    private String defaultHrEmail;

    @Value("${APP_DEFAULT_CANDIDATE_USERNAME:candidat}")
    private String defaultCandidateUsername;

    @Value("${APP_DEFAULT_CANDIDATE_PASSWORD:}")
    private String defaultCandidatePassword;

    @Value("${APP_DEFAULT_CANDIDATE_EMAIL:}")
    private String defaultCandidateEmail;

    @Override
    public void run(String... args) throws Exception {
        if (createDefaultUsers) {
            logger.info("🚀 Initialisation des utilisateurs par défaut activée");
            createDefaultUsersInternal();
        } else {
            logger.info("ℹ️  Initialisation des utilisateurs par défaut désactivée");
        }
    }

    private void createDefaultUsersInternal() {
        // Vérifier si des utilisateurs existent déjà
        try {
            String countQuery = "SELECT COUNT(*) FROM users";
            Integer userCount = jdbcTemplate.queryForObject(countQuery, Integer.class);
            
            if (userCount != null && userCount > 0) {
                logger.info("ℹ️  Des utilisateurs existent déjà ({} utilisateurs trouvés). Initialisation ignorée.", userCount);
                return;
            }
            
            logger.info("🚀 Aucun utilisateur trouvé. Création des utilisateurs par défaut...");
            
        } catch (Exception e) {
            logger.error("Erreur lors de la vérification des utilisateurs existants: {}", e.getMessage());
            return;
        }
        
        // D'abord, vérifier la structure de la table users (en mode debug)
        if (logger.isDebugEnabled()) {
            try {
                String describeQuery = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users'";
                logger.debug("=== STRUCTURE DE LA TABLE USERS ===");
                jdbcTemplate.query(describeQuery, (rs) -> {
                    logger.debug("Colonne: {} | Type: {} | Nullable: {}", 
                        rs.getString("column_name"), 
                        rs.getString("data_type"), 
                        rs.getString("is_nullable"));
                });
                logger.debug("=== FIN STRUCTURE TABLE USERS ===");
            } catch (Exception e) {
                logger.error("Erreur lors de la vérification de la structure: {}", e.getMessage());
            }
        }
        
        if (defaultAdminPassword == null || defaultAdminPassword.isBlank()
                || defaultAdminEmail == null || defaultAdminEmail.isBlank()
                || defaultHrPassword == null || defaultHrPassword.isBlank()
                || defaultHrEmail == null || defaultHrEmail.isBlank()
                || defaultCandidatePassword == null || defaultCandidatePassword.isBlank()
                || defaultCandidateEmail == null || defaultCandidateEmail.isBlank()) {
            logger.warn("Initialisation ignorée : les variables APP_DEFAULT_* nécessaires ne sont pas configurées.");
            return;
        }

        createUser(defaultAdminUsername, defaultAdminPassword, defaultAdminEmail,
                  "Administrateur", "JOB4YOU", "ROLE_ADMIN", "Utilisateur administrateur");

        createUser(defaultHrUsername, defaultHrPassword, defaultHrEmail,
                  "Responsable", "RH", "ROLE_HR", "Utilisateur RH");

        createUser(defaultCandidateUsername, defaultCandidatePassword, defaultCandidateEmail,
                  "Candidat", "Test", "ROLE_USER", "Utilisateur candidat");
        
        logger.info("✅ Création des utilisateurs par défaut terminée avec succès!");
    }

    private void createUser(String username, String password, String email, 
                           String firstName, String lastName, String role, String description) {
        try {
            // Vérifier si l'utilisateur existe déjà
            String checkQuery = "SELECT COUNT(*) FROM users WHERE username = ?";
            Integer count = jdbcTemplate.queryForObject(checkQuery, Integer.class, username);            if (count == null || count == 0) {
                logger.info("Création de l'utilisateur: {} ({})", username, description);

                // Encoder le mot de passe
                String encodedPassword = passwordEncoder.encode(password);

                // Insérer l'utilisateur avec seulement les colonnes de base
                String insertQuery = "INSERT INTO users (username, password, email, first_name, last_name) VALUES (?, ?, ?, ?, ?)";

                int result = jdbcTemplate.update(insertQuery,
                    username, encodedPassword, email, firstName, lastName);

                if (result > 0) {
                    assignRole(username, role);
                    logger.info("✅ Utilisateur '{}' créé avec succès !", username);
                    logger.info("  Username: {}", username);
                    logger.info("  Password: [masqué]");
                    logger.info("  Role: {}", role);                } else {
                    logger.error("❌ Échec de la création de l'utilisateur '{}'", username);
                }
            } else {
                assignRole(username, role);
                logger.info("ℹ️  L'utilisateur '{}' existe déjà", username);
            }

        } catch (Exception e) {
            logger.error("❌ Erreur lors de la création de l'utilisateur '{}': {}", username, e.getMessage());
        }
    }

    private void assignRole(String username, String roleName) {
        try {
            Long userId = jdbcTemplate.queryForObject(
                    "SELECT id FROM users WHERE username = ?", Long.class, username);
            Long roleId = jdbcTemplate.queryForObject(
                    "SELECT id FROM roles WHERE name = ?", Long.class, roleName);
            if (userId != null && roleId != null) {
                Integer relationCount = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM user_roles WHERE user_id = ? AND role_id = ?",
                        Integer.class, userId, roleId);
                if (relationCount == null || relationCount == 0) {
                    jdbcTemplate.update(
                            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                            userId, roleId);
                }
            }
        } catch (Exception e) {
            logger.warn("Impossible d'associer le rôle {} à l'utilisateur {} : {}", roleName, username, e.getMessage());
        }
    }
}
