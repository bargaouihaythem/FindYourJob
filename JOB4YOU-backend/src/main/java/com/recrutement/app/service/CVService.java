package com.recrutement.app.service;

import com.recrutement.app.dto.CVResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.repository.CandidateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CVService {

    @Autowired
    private CVRepository cvRepository;

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private LocalFileStorageService localFileStorageService;

    /**
     * Télécharge un nouveau CV pour un candidat
     */
    @Transactional
    public CVResponse uploadCV(Long candidateId, MultipartFile cvFile) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + candidateId));

        // Valider le fichier CV
        validateCVFile(cvFile);

        // Supprimer l'ancien CV s'il existe
        if (candidate.getCv() != null) {
            // Supprimer le fichier local si il existe
            if (candidate.getCv().getStoredFilename() != null) {
                localFileStorageService.deleteFile(candidate.getCv().getStoredFilename());
            }
            cvRepository.delete(candidate.getCv());
        }

        // Stocker le nouveau CV localement
        Map<String, String> storeResult = localFileStorageService.storeFile(cvFile);

        // Créer l'entité CV
        CV cv = new CV();
        cv.setOriginalFilename(cvFile.getOriginalFilename());
        cv.setStoredFilename(storeResult.get("fileName"));
        cv.setFilePath(storeResult.get("path"));
        cv.setFileUrl(storeResult.get("url"));
        cv.setFileSize(Long.valueOf(storeResult.get("fileSize")));
        cv.setContentType(cvFile.getContentType());
        cv.setCandidate(candidate);
        cv.setUploadDate(LocalDateTime.now());
        cv.setLastAccessed(LocalDateTime.now());

        CV savedCV = cvRepository.save(cv);
        return new CVResponse(savedCV);
    }

    /**
     * Récupère le CV d'un candidat
     */
    public CVResponse getCVByCandidate(Long candidateId) {
        CV cv = cvRepository.findByCandidateId(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé pour le candidat avec l'ID: " + candidateId));
        
        // Mettre à jour la date de dernier accès
        cv.setLastAccessed(LocalDateTime.now());
        cvRepository.save(cv);
        
        return new CVResponse(cv);
    }

    /**
     * Récupère un CV par son ID
     */
    public CVResponse getCVById(Long id) {
        CV cv = cvRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé avec l'ID: " + id));
        
        // Mettre à jour la date de dernier accès
        cv.setLastAccessed(LocalDateTime.now());
        cvRepository.save(cv);
        
        return new CVResponse(cv);
    }

    /**
     * Récupère tous les CVs d'une offre d'emploi
     */
    public List<CVResponse> getCVsByJobOffer(Long jobOfferId) {
        return cvRepository.findByJobOfferId(jobOfferId).stream()
                .map(CVResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Supprime un CV
     */
    @Transactional
    public void deleteCV(Long id) {
        CV cv = cvRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé avec l'ID: " + id));

        // Supprimer le fichier du système de fichiers
        if (cv.getStoredFilename() != null) {
            localFileStorageService.deleteFile(cv.getStoredFilename());
        }

        // Supprimer l'entité CV
        cvRepository.delete(cv);
    }

    /**
     * Récupère l'URL de téléchargement d'un CV
     */
    public String getCVDownloadUrl(Long id) {
        CV cv = cvRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé avec l'ID: " + id));
        
        // Mettre à jour la date de dernier accès
        cv.setLastAccessed(LocalDateTime.now());
        cvRepository.save(cv);
        
        System.out.println("[DEBUG] Download - CV ID: " + id);
        System.out.println("[DEBUG] Download - fileUrl: " + cv.getFileUrl());
        
        String url = cv.getFileUrl();
        if (url == null || url.isEmpty()) {
            throw new ResourceNotFoundException("Aucune URL disponible pour ce CV");
        }
        
        return url;
    }

    /**
     * Vérifie si un candidat a un CV
     */
    public boolean candidateHasCV(Long candidateId) {
        return cvRepository.existsByCandidateId(candidateId);
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

    /**
     * Obtient l'URL de visualisation d'un CV
     */
    public String getCVViewUrl(Long cvId) {
        CV cv = cvRepository.findById(cvId)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé avec l'ID: " + cvId));
        
        // Mettre à jour la date de dernier accès
        cv.setLastAccessed(LocalDateTime.now());
        cvRepository.save(cv);
        
        System.out.println("[DEBUG] CV ID: " + cvId);
        System.out.println("[DEBUG] fileUrl: " + cv.getFileUrl());
        System.out.println("[DEBUG] storedFilename: " + cv.getStoredFilename());
        
        String url = cv.getFileUrl();
        if (url == null || url.isEmpty()) {
            throw new ResourceNotFoundException("Aucune URL disponible pour ce CV");
        }
        
        System.out.println("[DEBUG] Final URL returned: " + url);
        return url;
    }

    /**
     * Obtient l'URL de visualisation du CV d'un candidat
     */
    public String getCandidateCVViewUrl(Long candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + candidateId));
        
        if (candidate.getCv() == null) {
            throw new ResourceNotFoundException("Aucun CV trouvé pour ce candidat");
        }
        
        return getCVViewUrl(candidate.getCv().getId());
    }

    /**
     * Corrige tous les CV avec des URLs cassées
     */
    @Transactional
    public int fixBrokenCVs() {
        List<CV> allCVs = cvRepository.findAll();
        int fixedCount = 0;
        
        for (CV cv : allCVs) {
            // Vérifier si le CV a besoin d'être corrigé
            boolean needsFix = (cv.getFileUrl() == null || cv.getFileUrl().isEmpty()) ||
                             (cv.getFileUrl() != null && (cv.getFileUrl().contains("test.url") || 
                              cv.getFileUrl().contains("cloudinary.com")));
            
            if (needsFix) {
                System.out.println("[DEBUG] Correction du CV ID: " + cv.getId());
                
                // Créer un nom de fichier unique
                String fileName = "cv_fixed_" + cv.getId() + ".pdf";
                
                // Créer un fichier PDF de test
                Map<String, String> testFileResult = localFileStorageService.createTestPDF(fileName);
                
                // Mettre à jour les informations du CV
                cv.setStoredFilename(testFileResult.get("fileName"));
                cv.setFilePath(testFileResult.get("path"));
                cv.setFileUrl(testFileResult.get("url"));
                cv.setLastAccessed(LocalDateTime.now());
                
                cvRepository.save(cv);
                fixedCount++;
                
                System.out.println("[DEBUG] CV corrigé avec nouvelle URL: " + cv.getFileUrl());
            }
        }
        
        System.out.println("[DEBUG] " + fixedCount + " CV(s) corrigé(s)");
        return fixedCount;
    }

    /**
     * Corrige un CV avec URL défaillante en créant un fichier local
     */
    @Transactional
    public CVResponse fixCV(Long cvId) {
        CV cv = cvRepository.findById(cvId)
                .orElseThrow(() -> new ResourceNotFoundException("CV non trouvé avec l'ID: " + cvId));
        
        System.out.println("[DEBUG] Correction du CV ID: " + cvId);
        System.out.println("[DEBUG] Ancien fileUrl: " + cv.getFileUrl());
        
        // Créer un nouveau fichier PDF local
        String fileName = "cv_fixed_" + cvId + ".pdf";
        Map<String, String> fileResult = localFileStorageService.createTestPDF(fileName);
        
        // Mettre à jour le CV avec les nouvelles informations
        cv.setStoredFilename(fileResult.get("fileName"));
        cv.setFilePath(fileResult.get("path"));
        cv.setFileUrl(fileResult.get("url"));
        cv.setFileSize(Long.valueOf(fileResult.get("fileSize")));
        cv.setLastAccessed(LocalDateTime.now());
        
        CV savedCV = cvRepository.save(cv);
        
        System.out.println("[DEBUG] CV corrigé - Nouvelle URL: " + savedCV.getFileUrl());
        
        return new CVResponse(savedCV);
    }
}

