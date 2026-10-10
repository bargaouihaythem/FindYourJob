package com.recrutement.app.controller;

import com.recrutement.app.dto.JobMatchResponse;
import com.recrutement.app.dto.MessageResponse;
import com.recrutement.app.service.CvTextExtractionService;
import com.recrutement.app.service.MatchingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Matching inverse : un visiteur (avec ou sans compte) dépose son CV et
 * découvre les offres actives les plus adaptées à son profil, sans avoir
 * besoin de postuler au préalable.
 */

@RestController
@RequestMapping("/api/matching")
@Tag(name = "Matching", description = "Suggestion d'offres à partir d'un CV")
public class MatchingController {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    @Autowired
    private CvTextExtractionService cvTextExtractionService;

    @Autowired
    private MatchingService matchingService;

    @Autowired
    private com.recrutement.app.service.AiScoringService aiScoringService;

    @Autowired
    private com.recrutement.app.repository.JobOfferRepository jobOfferRepository;

    @PostMapping("/upload-cv")
    @Operation(summary = "Upload d'un CV et suggestion des offres actives les plus adaptées")
    public ResponseEntity<?> uploadCvAndSuggest(
            @Parameter(description = "Fichier CV (PDF, DOC, DOCX)")
            @RequestParam("cv") MultipartFile cvFile) {
        try {
            validateFile(cvFile);

            String text = cvTextExtractionService.extractText(
                    cvFile.getInputStream(), cvFile.getContentType(), cvFile.getOriginalFilename());

            if (text == null || text.isBlank()) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                        "Impossible d'extraire le texte de ce CV (document scanné/image non supporté)"));
            }

            List<JobMatchResponse> suggestions = matchingService.suggestOffers(text);
            return ResponseEntity.ok(suggestions);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Erreur lors de l'analyse du CV: " + e.getMessage()));
        }
    }

    @PostMapping("/evaluate-gold-set")
    @Operation(summary = "Évaluation d'un CV du Gold Set par rapport à une offre cible (Remarque 1 & 3)")
    public ResponseEntity<?> evaluateGoldSetProfile(
            @RequestParam("cv") MultipartFile cvFile,
            @RequestParam("jobOfferId") Long jobOfferId) {
        try {
            validateFile(cvFile);

            com.recrutement.app.entity.JobOffer jobOffer = jobOfferRepository.findById(jobOfferId)
                    .orElseThrow(() -> new IllegalArgumentException("Offre non trouvée : " + jobOfferId));

            String text = cvTextExtractionService.extractText(
                    cvFile.getInputStream(), cvFile.getContentType(), cvFile.getOriginalFilename());

            // Construction d'un candidat de test éphémère
            com.recrutement.app.entity.Candidate tempCandidate = new com.recrutement.app.entity.Candidate();
            tempCandidate.setFirstName("GoldSet");
            tempCandidate.setLastName("Candidate");
            tempCandidate.setJobOffer(jobOffer);

            com.recrutement.app.entity.CV tempCv = new com.recrutement.app.entity.CV();
            tempCv.setOriginalFilename(cvFile.getOriginalFilename());
            tempCv.setExtractedText(text);
            tempCandidate.setCv(tempCv);

            com.recrutement.app.service.AiScoringService.AiScoreResult result =
                    aiScoringService.computeScore(tempCandidate, jobOffer);

            java.util.Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("jobOfferId", jobOffer.getId());
            response.put("jobOfferTitle", jobOffer.getTitle());
            response.put("finalScore", result.finalScore);
            response.put("technicalScore", result.technicalScore);
            response.put("communicationScore", result.communicationScore);
            response.put("seniorityMatchScore", result.seniorityMatchScore);
            response.put("source", result.source);
            response.put("matchedSkills", result.matchedSkills);
            response.put("missingSkills", result.missingSkills);
            response.put("detailedJustification", result.detailedJustification);
            response.put("needsHumanReview", result.needsHumanReview);
            response.put("humanReviewReason", result.humanReviewReason);
            response.put("recommendation", result.recommendation);
            response.put("decisionThreshold50", result.finalScore >= 50);
            response.put("decisionThreshold60", result.finalScore >= 60);
            response.put("decisionThreshold70", result.finalScore >= 70);

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Erreur évaluation : " + e.getMessage()));
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier CV est obligatoire");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Le fichier CV ne doit pas dépasser 10MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf")
                && !contentType.equals("application/msword")
                && !contentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            throw new IllegalArgumentException("Le fichier CV doit être au format PDF, DOC ou DOCX");
        }
    }
}
