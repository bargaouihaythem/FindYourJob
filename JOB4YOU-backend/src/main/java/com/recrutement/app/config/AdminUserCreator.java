package com.recrutement.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Configuration pour créer l'utilisateur admin par défaut au démarrage
 */
@Component
public class AdminUserCreator implements CommandLineRunner {    
    private static final Logger logger = LoggerFactory.getLogger(AdminUserCreator.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Value("${app.init.create-default-users:false}")
    private boolean createDefaultUsers;

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
        
        createUser("haythemadmin", "haythemadmin", "haythemadmin@admin.com", 
                  "Haythem", "Admin", "ROLE_ADMIN", "Utilisateur admin");
        
        createUser("rh_user", "rh1234567", "rh@company.com", 
                  "Sarah", "RH", "ROLE_HR", "Utilisateur RH");
        
        createUser("candidat_test", "candidat123", "candidat@test.com", 
                  "Jean", "Dupont", "ROLE_USER", "Candidat simple");
        
        createUser("haythem_user", "haythem123", "bargaouihaythem1@gmail.com", 
                  "Haythem", "Bargaoui", "ROLE_USER", "Utilisateur de test pour mot de passe oublié");
        
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
                    logger.info("✅ Utilisateur '{}' créé avec succès !", username);
                    logger.info("  Username: {}", username);
                    logger.info("  Password: {}", password);
                    logger.info("  Role: {}", role);                } else {
                    logger.error("❌ Échec de la création de l'utilisateur '{}'", username);
                }
            } else {
                logger.info("ℹ️  L'utilisateur '{}' existe déjà", username);
            }

        } catch (Exception e) {
            logger.error("❌ Erreur lors de la création de l'utilisateur '{}': {}", username, e.getMessage());
        }
    }
}
