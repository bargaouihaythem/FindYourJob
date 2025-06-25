package com.recrutement.app.controller;

import com.recrutement.app.dto.CVResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.service.CVService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/cvs")
@Tag(name = "CVs", description = "API pour la gestion des CVs")
public class CVController {

    @Autowired
    private CVService cvService;

    @PostMapping("/upload/{candidateId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Télécharger un CV pour un candidat")
    public ResponseEntity<?> uploadCV(
            @PathVariable Long candidateId,
            @Parameter(description = "Fichier CV (PDF, DOC, DOCX)")
            @RequestParam("cv") MultipartFile cvFile) {
        
        try {
            CVResponse response = cvService.uploadCV(candidateId, cvFile);
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur lors du téléchargement du CV: " + e.getMessage()));
        }
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('ÉQUIPE') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer le CV d'un candidat")
    public ResponseEntity<CVResponse> getCVByCandidate(@PathVariable Long candidateId) {
        CVResponse response = cvService.getCVByCandidate(candidateId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('ÉQUIPE') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Récupérer un CV par ID")
    public ResponseEntity<CVResponse> getCVById(@PathVariable Long id) {
        CVResponse response = cvService.getCVById(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/job-offer/{jobOfferId}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Récupérer tous les CVs d'une offre d'emploi")
    public ResponseEntity<List<CVResponse>> getCVsByJobOffer(@PathVariable Long jobOfferId) {
        List<CVResponse> response = cvService.getCVsByJobOffer(jobOfferId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
    @Operation(summary = "Supprimer un CV")
    public ResponseEntity<MessageResponse> deleteCV(@PathVariable Long id) {
        cvService.deleteCV(id);
        return ResponseEntity.ok(new MessageResponse("CV supprimé avec succès"));
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('ÉQUIPE') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Obtenir l'URL de téléchargement d'un CV")
    public ResponseEntity<String> getCVDownloadUrl(@PathVariable Long id) {
        String downloadUrl = cvService.getCVDownloadUrl(id);
        return ResponseEntity.ok(downloadUrl);
    }

    @GetMapping("/candidate/{candidateId}/exists")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    @Operation(summary = "Vérifier si un candidat a un CV")
    public ResponseEntity<Boolean> candidateHasCV(@PathVariable Long candidateId) {
        boolean hasCV = cvService.candidateHasCV(candidateId);
        return ResponseEntity.ok(hasCV);
    }

    @GetMapping("/{id}/view")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('ÉQUIPE') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Obtenir l'URL de visualisation d'un CV")
    public ResponseEntity<String> getCVViewUrl(@PathVariable Long id) {
        String viewUrl = cvService.getCVViewUrl(id);
        return ResponseEntity.ok(viewUrl);
    }

    @GetMapping("/candidate/{candidateId}/view")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('ÉQUIPE') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    @Operation(summary = "Obtenir l'URL de visualisation du CV d'un candidat")
    public ResponseEntity<String> getCandidateCVViewUrl(@PathVariable Long candidateId) {
        String viewUrl = cvService.getCandidateCVViewUrl(candidateId);
        return ResponseEntity.ok(viewUrl);
    }

    @PostMapping("/test/create-sample")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer un CV de test avec stockage local")
    public ResponseEntity<?> createSampleCV() {
        try {
            // Créer un fichier PDF de test
            String content = "%PDF-1.4\n%âÃÄÅ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(CV de test) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000245 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n338\n%%EOF";
            
            // Créer le fichier de test
            Path uploadPath = Paths.get("uploads/cvs");
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            String testFileName = "cv_test_sample.pdf";
            Path testFilePath = uploadPath.resolve(testFileName);
            Files.write(testFilePath, content.getBytes());
            
            // Créer l'URL d'accès
            String fileUrl = "http://localhost:8080/api/files/" + testFileName;
            
            Map<String, String> response = Map.of(
                "message", "CV de test créé avec succès",
                "fileName", testFileName,
                "url", fileUrl,
                "path", testFilePath.toString()
            );
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Erreur lors de la création du CV de test: " + e.getMessage()));
        }
    }

    @PostMapping("/fix-broken-cvs")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Corriger les CV avec des URLs cassées")
    public ResponseEntity<?> fixBrokenCVs() {
        try {
            int fixedCount = cvService.fixBrokenCVs();
            return ResponseEntity.ok(Map.of(
                "message", "CV corrigés avec succès", 
                "fixedCount", fixedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Erreur lors de la correction des CV: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/fix-cv/{cvId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Corriger un CV avec URL défaillante")
    public ResponseEntity<?> fixCV(@PathVariable Long cvId) {
        try {
            CVResponse response = cvService.fixCV(cvId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur lors de la correction du CV: " + e.getMessage()));
        }
    }
}

