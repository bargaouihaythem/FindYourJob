package com.recrutement.app.service;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.JobOfferRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CandidateService {

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private JobOfferRepository jobOfferRepository;

    @Autowired
    private CVRepository cvRepository;

    @Autowired
    private LocalFileStorageService localFileStorageService;

    @Autowired
    private NotificationService notificationService;

    /**
     * Soumet une candidature avec CV
     */
    @Transactional
    public CandidateResponse submitApplication(ApplicationRequest applicationRequest, MultipartFile cvFile) {
        // Vérifier si l'offre d'emploi existe
        JobOffer jobOffer = jobOfferRepository.findById(applicationRequest.getJobOfferId())
                .orElseThrow(() -> new ResourceNotFoundException("Offre d'emploi non trouvée avec l'ID: " + applicationRequest.getJobOfferId()));

        // Vérifier si le candidat n'a pas déjà postulé pour cette offre
        if (candidateRepository.existsByEmailAndJobOfferId(applicationRequest.getEmail(), applicationRequest.getJobOfferId())) {
            throw new IllegalArgumentException("Vous avez déjà postulé pour cette offre d'emploi");
        }

        // Valider le fichier CV
        validateCVFile(cvFile);

        // Créer le candidat
        Candidate candidate = new Candidate();
        candidate.setFirstName(applicationRequest.getFirstName());
        candidate.setLastName(applicationRequest.getLastName());
        candidate.setEmail(applicationRequest.getEmail());
        candidate.setPhone(applicationRequest.getPhone());
        candidate.setAddress(applicationRequest.getAddress());
        candidate.setLinkedinProfile(applicationRequest.getLinkedinProfile());
        candidate.setCoverLetter(applicationRequest.getCoverLetter());
        candidate.setJobOffer(jobOffer);
        candidate.setStatus(Candidate.CandidateStatus.APPLIED);
        candidate.setApplicationDate(LocalDateTime.now());
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate savedCandidate = candidateRepository.save(candidate);

        // Télécharger le CV en stockage local
        Map<String, String> storeResult = localFileStorageService.storeFile(cvFile);

        // Créer l'entité CV
        CV cv = new CV();
        cv.setOriginalFilename(cvFile.getOriginalFilename());
        cv.setStoredFilename(storeResult.get("fileName"));
        cv.setFilePath(storeResult.get("path"));
        cv.setFileUrl(storeResult.get("url"));
        cv.setFileSize(Long.valueOf(storeResult.get("fileSize")));
        cv.setContentType(cvFile.getContentType());
        cv.setCandidate(savedCandidate);
        cv.setUploadDate(LocalDateTime.now());
        cv.setLastAccessed(LocalDateTime.now());

        cvRepository.save(cv);

        // Envoyer un e-mail de confirmation au candidat
        notificationService.sendApplicationConfirmation(savedCandidate);

        return new CandidateResponse(savedCandidate);
    }

    /**
     * Récupère tous les candidats
     */
    public List<CandidateResponse> getAllCandidates() {
        return candidateRepository.findAllWithDetails().stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère tous les candidats avec pagination et fetch du CV
     */
    public Page<CandidateResponse> getAllCandidates(Pageable pageable) {
        // On ignore la pagination ici pour garantir le fetch du CV
        List<Candidate> candidates = candidateRepository.findAllWithCV();
        List<CandidateResponse> responses = candidates.stream().map(CandidateResponse::new).toList();
        // Simuler la pagination manuellement
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), responses.size());
        List<CandidateResponse> pageContent = responses.subList(start, end);
        return new org.springframework.data.domain.PageImpl<>(pageContent, pageable, responses.size());
    }

    /**
     * Récupère un candidat par son ID
     */
    public CandidateResponse getCandidateById(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        return new CandidateResponse(candidate);
    }

    /**
     * Met à jour un candidat
     */
    @Transactional
    public CandidateResponse updateCandidate(Long id, CandidateRequest candidateRequest) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        candidate.setFirstName(candidateRequest.getFirstName());
        candidate.setLastName(candidateRequest.getLastName());
        candidate.setEmail(candidateRequest.getEmail());
        candidate.setPhone(candidateRequest.getPhone());
        candidate.setAddress(candidateRequest.getAddress());
        candidate.setLinkedinProfile(candidateRequest.getLinkedinProfile());
        candidate.setCoverLetter(candidateRequest.getCoverLetter());
        
        if (candidateRequest.getStatus() != null) {
            candidate.setStatus(candidateRequest.getStatus());
        }
        
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate updatedCandidate = candidateRepository.save(candidate);
        return new CandidateResponse(updatedCandidate);
    }

    /**
     * Supprime un candidat
     */
    @Transactional
    public void deleteCandidate(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        // Supprimer le CV du stockage local si il existe
        if (candidate.getCv() != null && candidate.getCv().getStoredFilename() != null) {
            localFileStorageService.deleteFile(candidate.getCv().getStoredFilename());
        }

        candidateRepository.delete(candidate);
    }

    /**
     * Récupère les candidats par offre d'emploi
     */
    public List<CandidateResponse> getCandidatesByJobOffer(Long jobOfferId) {
        return candidateRepository.findByJobOfferIdWithDetails(jobOfferId).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les candidats par offre d'emploi avec pagination
     */
    public Page<CandidateResponse> getCandidatesByJobOffer(Long jobOfferId, Pageable pageable) {
        return candidateRepository.findByJobOfferId(jobOfferId, pageable)
                .map(CandidateResponse::new);
    }

    /**
     * Récupère les candidats par statut
     */
    public List<CandidateResponse> getCandidatesByStatus(Candidate.CandidateStatus status) {
        return candidateRepository.findByStatus(status).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Recherche des candidats par nom
     */
    public List<CandidateResponse> searchCandidatesByName(String name) {
        return candidateRepository.findByFirstNameOrLastNameContaining(name).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Met à jour le statut d'un candidat
     */
    @Transactional
    public CandidateResponse updateCandidateStatus(Long id, Candidate.CandidateStatus status) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        candidate.setStatus(status);
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate updatedCandidate = candidateRepository.save(candidate);
        return new CandidateResponse(updatedCandidate);
    }

    /**
     * Récupère les candidats par email
     */
    public List<CandidateResponse> getCandidatesByEmail(String email) {
        return candidateRepository.findByEmail(email).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Valide le fichier CV
     */
    private void validateCVFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier CV est obligatoire");
        }

        // Vérifier la taille du fichier (max 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("Le fichier CV ne doit pas dépasser 10MB");
        }

        // Vérifier le type de fichier
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf") && 
            !contentType.equals("application/msword") && 
            !contentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            throw new IllegalArgumentException("Le fichier CV doit être au format PDF, DOC ou DOCX");
        }
    }
}

