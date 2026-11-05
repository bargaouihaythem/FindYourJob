package com.recrutement.app.controller;

import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.entity.GoldSetCase;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.service.GoldSetCalibrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Le Gold Set côté application : consulter les cas de référence, rejouer leur score
 * dans le circuit de décision, lire la mesure par profil et appliquer un seuil calibré.
 * Réservé RH/Admin : c'est l'atelier d'étalonnage, pas un écran candidat.
 */
@RestController
@RequestMapping("/api/gold-set")
@Tag(name = "Gold Set", description = "Corpus de référence, calibration du seuil et étalonnage de la décision")
@PreAuthorize("hasRole('HR') or hasRole('ADMIN')")
public class GoldSetController {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    @Autowired
    private GoldSetCalibrationService goldSetCalibrationService;

    @GetMapping("/cases")
    @Operation(summary = "Lister les cas du Gold Set (sans le texte extrait)")
    public ResponseEntity<List<Map<String, Object>>> listCases() {
        return ResponseEntity.ok(goldSetCalibrationService.listCases().stream()
                .map(this::summarize).toList());
    }

    @PostMapping("/cases")
    @Operation(summary = "Déposer un cas de référence anonymisé avec sa vérité terrain")
    public ResponseEntity<?> upsertCase(
            @RequestParam("cv") MultipartFile cvFile,
            @RequestParam String caseRef,
            @RequestParam String candidateName,
            @RequestParam Long jobOfferId,
            @RequestParam GoldSetCase.Relevance groundTruth,
            @RequestParam(defaultValue = "false") boolean borderline,
            @RequestParam(defaultValue = "EXTENSION_RH") GoldSetCase.Origin origin) {
        try {
            validateFile(cvFile);
            GoldSetCase saved = goldSetCalibrationService.upsertCase(caseRef, candidateName, jobOfferId,
                    groundTruth, borderline, origin, cvFile.getBytes(), cvFile.getContentType(),
                    cvFile.getOriginalFilename());
            return ResponseEntity.ok(summarize(saved));
        } catch (IllegalArgumentException | IOException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/report")
    @Operation(summary = "Mesure sur le dernier score enregistré (aucun appel à l'IA)")
    public ResponseEntity<?> report() {
        return measure(false);
    }

    @PostMapping("/calibrate")
    @Operation(summary = "Rejouer tout le corpus dans le circuit de décision et mesurer la qualité",
            description = "Un appel IA par cas de référence ; le balayage des seuils ne coûte rien de plus, "
                    + "la décision n'étant qu'une comparaison au score déjà obtenu.")
    public ResponseEntity<?> calibrate(@RequestParam(defaultValue = "true") boolean replay) {
        return measure(replay);
    }

    @PutMapping("/profiles/{jobFamily}/{seniorityLevel}/threshold")
    @Operation(summary = "Appliquer un seuil calibré à un profil",
            description = "Refusé si le noyau de référence du profil est trop mince ou si le F1 mesuré "
                    + "ne tient pas le minimum exigé : le seuil de production ne bouge que sur preuve.")
    public ResponseEntity<?> applyThreshold(
            @PathVariable JobOffer.JobFamily jobFamily,
            @PathVariable JobOffer.SeniorityLevel seniorityLevel,
            @RequestParam Integer threshold,
            Authentication authentication) {
        try {
            String actingUser = authentication != null ? authentication.getName() : "RH";
            goldSetCalibrationService.applyThreshold(jobFamily, seniorityLevel, threshold, actingUser);
            return ResponseEntity.ok(new MessageResponse(
                    "Seuil " + threshold + "/100 appliqué au profil " + jobFamily + " / " + seniorityLevel));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/profiles/{jobFamily}/{seniorityLevel}/threshold")
    @Operation(summary = "Rétablir le seuil par défaut sur un profil (sortie de calibration)")
    public ResponseEntity<?> resetThreshold(
            @PathVariable JobOffer.JobFamily jobFamily,
            @PathVariable JobOffer.SeniorityLevel seniorityLevel,
            Authentication authentication) {
        String actingUser = authentication != null ? authentication.getName() : "RH";
        goldSetCalibrationService.applyThreshold(jobFamily, seniorityLevel, null, actingUser);
        return ResponseEntity.ok(new MessageResponse(
                "Profil " + jobFamily + " / " + seniorityLevel + " rendu au seuil par défaut"));
    }

    private ResponseEntity<?> measure(boolean replay) {
        try {
            return ResponseEntity.ok(goldSetCalibrationService.calibrate(replay));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private Map<String, Object> summarize(GoldSetCase testCase) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", testCase.getId());
        row.put("caseRef", testCase.getCaseRef());
        row.put("candidateName", testCase.getCandidateName());
        row.put("originalFilename", testCase.getOriginalFilename());
        row.put("jobOfferId", testCase.getJobOffer().getId());
        row.put("jobOfferTitle", testCase.getJobOffer().getTitle());
        row.put("jobFamily", testCase.getJobOffer().getJobFamily());
        row.put("seniorityLevel", testCase.getJobOffer().getSeniorityLevel());
        row.put("groundTruth", testCase.getGroundTruth());
        row.put("expected", testCase.expectedRetain());
        row.put("borderline", testCase.isBorderline());
        row.put("origin", testCase.getOrigin());
        row.put("lastScore", testCase.getLastScore());
        row.put("lastScoreSource", testCase.getLastScoreSource());
        row.put("lastEvaluatedAt", testCase.getLastEvaluatedAt());
        row.put("extractedTextLength", testCase.getExtractedText() == null
                ? 0 : testCase.getExtractedText().length());
        return row;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier du cas de référence est obligatoire");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Le fichier ne doit pas dépasser 10MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf")
                && !contentType.equals("application/msword")
                && !contentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            throw new IllegalArgumentException("Le cas de référence doit être au format PDF, DOC ou DOCX");
        }
    }
}
