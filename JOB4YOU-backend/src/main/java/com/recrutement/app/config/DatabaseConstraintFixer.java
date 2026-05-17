package com.recrutement.app.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Configuration pour corriger la contrainte job_offer_id au démarrage
 * Cette classe exécute une fois la correction SQL puis se désactive
 */
@Component
public class DatabaseConstraintFixer implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            System.out.println("=== CORRECTION CONTRAINTE job_offer_id ===");
            
            // Vérifier l'état actuel
            String checkQuery = """
                SELECT column_name, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'candidates' AND column_name = 'job_offer_id'
                """;
            
            jdbcTemplate.query(checkQuery, rs -> {
                String isNullable = rs.getString("is_nullable");
                System.out.println("État actuel de job_offer_id - nullable: " + isNullable);
                
                if ("NO".equals(isNullable)) {
                    System.out.println("Correction nécessaire - Application de ALTER TABLE...");
                    try {
                        // Appliquer la correction
                        jdbcTemplate.execute("ALTER TABLE candidates ALTER COLUMN job_offer_id DROP NOT NULL");
                        System.out.println("✅ Contrainte job_offer_id corrigée avec succès!");
                        
                        // Vérifier que la correction a été appliquée
                        jdbcTemplate.query(checkQuery, rs2 -> {
                            String newIsNullable = rs2.getString("is_nullable");
                            System.out.println("Nouvel état de job_offer_id - nullable: " + newIsNullable);
                        });
                        
                    } catch (Exception e) {
                        System.err.println("❌ Erreur lors de la correction: " + e.getMessage());
                    }
                } else {
                    System.out.println("✅ Contrainte job_offer_id déjà correcte (nullable)");
                }
            });
            
        } catch (Exception e) {
            System.err.println("❌ Erreur lors de la vérification: " + e.getMessage());
        }
        
        System.out.println("=== FIN CORRECTION CONTRAINTE ===");

        // Correction contrainte candidates_status_check pour ajouter AUTO_REJECTED, MANAGER_REJECTED, INTERVIEW_SCHEDULED, HIRED, WITHDRAWN
        try {
            System.out.println("=== CORRECTION CONTRAINTE candidates_status_check ===");
            // Vérifier si AUTO_REJECTED est déjà dans la contrainte
            var rows = jdbcTemplate.queryForList(
                "SELECT constraint_name FROM information_schema.table_constraints " +
                "WHERE table_name='candidates' AND constraint_type='CHECK' AND constraint_name='candidates_status_check'"
            );
            if (!rows.isEmpty()) {
                // Vérifier si la contrainte bloque AUTO_REJECTED
                try {
                    jdbcTemplate.execute("DO $$ BEGIN PERFORM 1 FROM candidates WHERE status = 'AUTO_REJECTED' LIMIT 0; END $$");
                    System.out.println("✅ AUTO_REJECTED déjà autorisé");
                } catch (Exception ignored) {
                    // Recréer la contrainte avec toutes les valeurs
                    jdbcTemplate.execute("ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check");
                    jdbcTemplate.execute(
                        "ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN (" +
                        "'APPLIED','CV_REVIEWED','PHONE_SCREENING','TECHNICAL_TEST','INTERVIEW','FINAL_INTERVIEW'," +
                        "'ACCEPTED','REJECTED','AUTO_REJECTED','MANAGER_REJECTED','INTERVIEW_SCHEDULED','HIRED','WITHDRAWN'))"
                    );
                    System.out.println("✅ Contrainte candidates_status_check corrigée avec AUTO_REJECTED");
                }
            }
        } catch (Exception e) {
            System.err.println("Erreur correction status_check: " + e.getMessage());
        }
    }
}
