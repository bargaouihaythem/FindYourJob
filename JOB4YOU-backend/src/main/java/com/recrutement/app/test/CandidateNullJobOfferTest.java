package com.recrutement.app.test;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.repository.CandidateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Test pour vérifier que les candidats peuvent être créés sans offre d'emploi
 */
@RestController
@RequestMapping("/api/test")
@CrossOrigin(origins = "*")
public class CandidateNullJobOfferTest {

    @Autowired
    private CandidateRepository candidateRepository;

    @PostMapping("/candidate-without-job")
    public ResponseEntity<?> testCandidateWithoutJob() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            System.out.println("=== TEST: Création d'un candidat sans offre d'emploi ===");
            
            Candidate candidate = new Candidate();
            candidate.setFirstName("Test");
            candidate.setLastName("User");
            candidate.setEmail("test.nulljob" + System.currentTimeMillis() + "@example.com");
            candidate.setPhone("123456789");
            candidate.setAddress("Test Address");
            candidate.setCoverLetter("Test cover letter for CV improvement");
            // Note: jobOffer reste null intentionnellement
            
            Candidate savedCandidate = candidateRepository.save(candidate);
            
            System.out.println("✅ SUCCESS: Candidat créé avec succès sans offre d'emploi !");
            System.out.println("   ID: " + savedCandidate.getId());
            System.out.println("   Nom: " + savedCandidate.getFirstName() + " " + savedCandidate.getLastName());
            System.out.println("   Email: " + savedCandidate.getEmail());
            System.out.println("   JobOffer: " + (savedCandidate.getJobOffer() == null ? "null (OK)" : "NOT NULL"));
            
            response.put("success", true);
            response.put("message", "Candidat créé avec succès sans offre d'emploi");
            response.put("candidateId", savedCandidate.getId());
            response.put("candidateName", savedCandidate.getFirstName() + " " + savedCandidate.getLastName());
            response.put("candidateEmail", savedCandidate.getEmail());
            response.put("jobOfferNull", savedCandidate.getJobOffer() == null);
            
            // Nettoyage
            candidateRepository.delete(savedCandidate);
            System.out.println("✅ Candidat de test supprimé");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ ERREUR lors de la création du candidat sans offre d'emploi:");
            System.err.println("   " + e.getMessage());
            e.printStackTrace();
            
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("errorType", e.getClass().getSimpleName());
            
            return ResponseEntity.badRequest().body(response);
        }
    }
}
