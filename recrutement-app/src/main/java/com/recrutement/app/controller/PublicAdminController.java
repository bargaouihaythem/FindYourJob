package com.recrutement.app.controller;

import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.repository.CVRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/public/admin")
@Tag(name = "Public Admin", description = "Endpoints publics d'administration (sans authentification)")
public class PublicAdminController {

    @Autowired
    private CVRepository cvRepository;

    @GetMapping("/cv-diagnostic")
    @Operation(summary = "Diagnostic public des CV (sans authentification)")
    public ResponseEntity<String> cvDiagnostic() {
        List<CV> allCVs = cvRepository.findAll();
        StringBuilder result = new StringBuilder();
        result.append("=== DIAGNOSTIC CV PUBLIC ===\n");
        
        int problemCount = 0;
        for (CV cv : allCVs) {
            if (cv.getStoredFilename() != null && cv.getFileUrl() != null) {
                String expectedUrl = "http://localhost:8080/api/files/" + cv.getStoredFilename();
                boolean hasUrlMismatch = !cv.getFileUrl().equals(expectedUrl);
                
                if (hasUrlMismatch) {
                    result.append("❌ PROBLEME - CV ID: ").append(cv.getId()).append("\n");
                    result.append("   URL actuelle: ").append(cv.getFileUrl()).append("\n");
                    result.append("   URL attendue: ").append(expectedUrl).append("\n");
                    result.append("   Fichier stocké: ").append(cv.getStoredFilename()).append("\n");
                    problemCount++;
                } else {
                    result.append("✅ OK - CV ID: ").append(cv.getId()).append(" - ").append(cv.getStoredFilename()).append("\n");
                }
            }
            result.append("---\n");
        }
        
        result.append("\nRÉSUMÉ: ").append(problemCount).append(" problème(s) détecté(s) sur ").append(allCVs.size()).append(" CV(s)\n");
        
        return ResponseEntity.ok(result.toString());
    }

    @PostMapping("/fix-cv-urls")
    @Operation(summary = "Correction publique des URLs de CV (sans authentification)")
    public ResponseEntity<MessageResponse> fixCVUrls() {
        List<CV> allCVs = cvRepository.findAll();
        int fixedCount = 0;

        for (CV cv : allCVs) {
            if (cv.getStoredFilename() != null && cv.getFileUrl() != null) {
                String expectedUrl = "http://localhost:8080/api/files/" + cv.getStoredFilename();
                
                if (!cv.getFileUrl().equals(expectedUrl)) {
                    System.out.println("[PUBLIC-FIX] CV ID " + cv.getId() + 
                                     " - URL corrigée: " + expectedUrl);
                    
                    cv.setFileUrl(expectedUrl);
                    cvRepository.save(cv);
                    fixedCount++;
                }
            }
        }

        return ResponseEntity.ok(new MessageResponse(
            "✅ Correction publique terminée: " + fixedCount + " CV(s) corrigé(s) sur " + allCVs.size() + " total."));
    }

    @PostMapping("/clean-test-cvs")
    @Operation(summary = "Nettoyer tous les CV de test")
    public ResponseEntity<MessageResponse> cleanTestCVs() {
        List<CV> testCVs = cvRepository.findAll().stream()
                .filter(cv -> cv.getStoredFilename() != null && 
                             (cv.getStoredFilename().contains("test_cv_") || 
                              cv.getStoredFilename().contains("cv_test_") ||
                              cv.getStoredFilename().contains("cv_fixed_")))
                .toList();
        
        int deletedCount = 0;
        for (CV cv : testCVs) {
            System.out.println("[CLEAN-PUBLIC] Suppression CV de test ID: " + cv.getId() + 
                             " - Fichier: " + cv.getStoredFilename());
            cvRepository.delete(cv);
            deletedCount++;
        }

        return ResponseEntity.ok(new MessageResponse(
            "🗑️ CV de test supprimés: " + deletedCount));
    }
}
