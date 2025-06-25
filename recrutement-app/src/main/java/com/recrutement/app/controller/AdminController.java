package com.recrutement.app.controller;

import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.repository.CVRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "API d'administration pour corriger les données")
public class AdminController {

    @Autowired
    private CVRepository cvRepository;    
    @PostMapping("/fix-cv-urls")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Corriger toutes les URLs de CV invalides")
    public ResponseEntity<MessageResponse> fixCVUrls() {
        List<CV> allCVs = cvRepository.findAll();
        int fixedCount = 0;

        for (CV cv : allCVs) {
            boolean needsUpdate = false;
            
            // Si fileUrl est null ou contient une URL invalide, ou si il y a un décalage de nom
            if (cv.getFileUrl() == null || 
                cv.getFileUrl().contains("test.url") || 
                cv.getFileUrl().contains("cloudinary.com") ||
                (cv.getStoredFilename() != null && cv.getFileUrl() != null && 
                 !cv.getFileUrl().contains(cv.getStoredFilename()))) {
                
                // Si on a déjà un storedFilename valide, l'utiliser
                String fileName;
                if (cv.getStoredFilename() != null && !cv.getStoredFilename().isEmpty()) {
                    fileName = cv.getStoredFilename();
                } else {
                    // Générer un nouveau nom de fichier
                    fileName = "cv_fixed_" + cv.getId() + ".pdf";
                    cv.setStoredFilename(fileName);
                }
                
                String newUrl = "http://localhost:8080/api/files/" + fileName;
                cv.setFileUrl(newUrl);
                needsUpdate = true;
                
                System.out.println("[FIX] CV ID " + cv.getId() + " - Nouvelle URL: " + newUrl + " - Fichier: " + fileName);
            }
              if (needsUpdate) {
                cvRepository.save(cv);
                fixedCount++;
            }
        }

        return ResponseEntity.ok(new MessageResponse(
            "URLs corrigées pour " + fixedCount + " CV(s). Total de CV: " + allCVs.size()));
    }

    @PostMapping("/create-test-cv/{candidateId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer un CV de test pour un candidat")
    public ResponseEntity<MessageResponse> createTestCV(@PathVariable Long candidateId) {
        try {
            // Créer un CV de test avec une URL locale valide
            CV testCV = new CV();
            testCV.setOriginalFilename("CV_Test_" + candidateId + ".pdf");
            testCV.setStoredFilename("cv_test_" + candidateId + ".pdf");
            testCV.setFileUrl("http://localhost:8080/api/files/cv_test_" + candidateId + ".pdf");
            testCV.setFileSize(1024L); // 1KB
            testCV.setContentType("application/pdf");
            
            // Vous devrez peut-être ajuster ceci selon votre structure
            // testCV.setCandidate(candidate);
            
            cvRepository.save(testCV);
            
            return ResponseEntity.ok(new MessageResponse(
                "CV de test créé avec URL: " + testCV.getFileUrl()));
                
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                "Erreur lors de la création du CV de test: " + e.getMessage()));
        }
    }

    @GetMapping("/list-cv-urls")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Lister toutes les URLs de CV pour diagnostic")
    public ResponseEntity<String> listCVUrls() {
        List<CV> allCVs = cvRepository.findAll();
        StringBuilder result = new StringBuilder();
        result.append("=== DIAGNOSTIC DES CV ===\n");
          for (CV cv : allCVs) {
            result.append("CV ID: ").append(cv.getId()).append("\n");
            result.append("  - fileUrl: ").append(cv.getFileUrl()).append("\n");
            result.append("  - storedFilename: ").append(cv.getStoredFilename()).append("\n");
            result.append("  - originalFilename: ").append(cv.getOriginalFilename()).append("\n");
            result.append("---\n");
        }
        
        return ResponseEntity.ok(result.toString());
    }

    @PostMapping("/fix-timestamp-mismatch")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Corriger les décalages de timestamp dans les URLs de CV")
    public ResponseEntity<MessageResponse> fixTimestampMismatch() {
        List<CV> allCVs = cvRepository.findAll();
        int fixedCount = 0;

        for (CV cv : allCVs) {
            if (cv.getStoredFilename() != null && cv.getFileUrl() != null) {
                String expectedUrl = "http://localhost:8080/api/files/" + cv.getStoredFilename();
                
                if (!cv.getFileUrl().equals(expectedUrl)) {
                    System.out.println("[FIX-TIMESTAMP] CV ID " + cv.getId() + 
                                     " - URL actuelle: " + cv.getFileUrl() + 
                                     " - URL corrigée: " + expectedUrl);
                    
                    cv.setFileUrl(expectedUrl);
                    cvRepository.save(cv);
                    fixedCount++;
                }
            }
        }

        return ResponseEntity.ok(new MessageResponse(
            "Décalages de timestamp corrigés pour " + fixedCount + " CV(s). Total vérifié: " + allCVs.size()));
    }

    @PostMapping("/clean-test-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Supprimer tous les CV de test")
    public ResponseEntity<MessageResponse> cleanTestData() {
        List<CV> testCVs = cvRepository.findAll().stream()
                .filter(cv -> cv.getStoredFilename() != null && 
                             (cv.getStoredFilename().contains("test_cv_") || 
                              cv.getStoredFilename().contains("cv_test_")))
                .toList();
        
        int deletedCount = 0;
        for (CV cv : testCVs) {
            System.out.println("[CLEAN] Suppression CV de test ID: " + cv.getId() + 
                             " - Fichier: " + cv.getStoredFilename());
            cvRepository.delete(cv);
            deletedCount++;
        }

        return ResponseEntity.ok(new MessageResponse(
            "CV de test supprimés: " + deletedCount));
    }    @GetMapping("/public/cv-diagnostic")
    @Operation(summary = "Diagnostic public des CV (sans authentification)")
    public ResponseEntity<String> publicCVDiagnostic() {
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

    @PostMapping("/public/fix-cv-urls")
    @Operation(summary = "Correction publique des URLs de CV (sans authentification)")
    public ResponseEntity<MessageResponse> publicFixCVUrls() {
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
}
