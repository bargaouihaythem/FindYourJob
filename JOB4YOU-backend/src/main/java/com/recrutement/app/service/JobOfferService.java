package com.recrutement.app.service;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.dto.JobOfferResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class JobOfferService {

    @Autowired
    private JobOfferRepository jobOfferRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Crée une nouvelle offre d'emploi
     */
    @Transactional
    public JobOfferResponse createJobOffer(JobOfferRequest jobOfferRequest, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));

        JobOffer jobOffer = new JobOffer();
        mapRequestToEntity(jobOfferRequest, jobOffer);
        jobOffer.setCreatedBy(user);
        jobOffer.setCreatedAt(LocalDateTime.now());
        jobOffer.setUpdatedAt(LocalDateTime.now());

        JobOffer savedJobOffer = jobOfferRepository.save(jobOffer);
        return new JobOfferResponse(savedJobOffer);
    }

    /**
     * Récupère toutes les offres d'emploi
     */
    public List<JobOfferResponse> getAllJobOffers() {
        return jobOfferRepository.findAll().stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère toutes les offres d'emploi avec pagination
     */
    public Page<JobOfferResponse> getAllJobOffers(Pageable pageable) {
        return jobOfferRepository.findAll(pageable)
                .map(JobOfferResponse::new);
    }

    /**
     * Récupère une offre d'emploi par son ID
     */
    public JobOfferResponse getJobOfferById(Long id) {
        JobOffer jobOffer = jobOfferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + id));
        return new JobOfferResponse(jobOffer);
    }

    /**
     * Met à jour une offre d'emploi
     */
    @Transactional
    public JobOfferResponse updateJobOffer(Long id, JobOfferRequest jobOfferRequest) {
        JobOffer jobOffer = jobOfferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + id));

        mapRequestToEntity(jobOfferRequest, jobOffer);
        jobOffer.setUpdatedAt(LocalDateTime.now());

        JobOffer updatedJobOffer = jobOfferRepository.save(jobOffer);
        return new JobOfferResponse(updatedJobOffer);
    }

    /**
     * Supprime une offre d'emploi
     */
    @Transactional
    public void deleteJobOffer(Long id) {
        JobOffer jobOffer = jobOfferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + id));
        jobOfferRepository.delete(jobOffer);
    }

    /**
     * Récupère les offres d'emploi par statut
     */
    public List<JobOfferResponse> getJobOffersByStatus(JobOffer.JobStatus status) {
        return jobOfferRepository.findByStatus(status).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les offres d'emploi par statut avec pagination
     */
    public Page<JobOfferResponse> getJobOffersByStatus(JobOffer.JobStatus status, Pageable pageable) {
        return jobOfferRepository.findByStatus(status, pageable)
                .map(JobOfferResponse::new);
    }

    /**
     * Recherche des offres d'emploi par mot-clé
     */
    public List<JobOfferResponse> searchJobOffers(String keyword) {
        return jobOfferRepository.findByTitleOrDescriptionContaining(keyword).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Recherche des offres d'emploi par localisation
     */
    public List<JobOfferResponse> searchJobOffersByLocation(String location) {
        return jobOfferRepository.findByLocationContaining(location).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les offres d'emploi créées par un utilisateur
     */
    public List<JobOfferResponse> getJobOffersByUser(Long userId) {
        return jobOfferRepository.findByCreatedById(userId).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les offres d'emploi expirées
     */
    public List<JobOfferResponse> getExpiredJobOffers() {
        return jobOfferRepository.findExpiredOffers(LocalDateTime.now(), JobOffer.JobStatus.ACTIVE).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les offres d'emploi par type de contrat et statut
     */
    public List<JobOfferResponse> getJobOffersByContractTypeAndStatus(String contractType, JobOffer.JobStatus status) {
        return jobOfferRepository.findByContractTypeAndStatus(contractType, status).stream()
                .map(JobOfferResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Met à jour le statut d'une offre d'emploi
     */
    @Transactional
    public void updateJobOfferStatus(Long id, JobOffer.JobStatus status) {
        JobOffer jobOffer = jobOfferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + id));
        
        jobOffer.setStatus(status);
        jobOffer.setUpdatedAt(LocalDateTime.now());
        jobOfferRepository.save(jobOffer);
    }

    /**
     * Récupère les statistiques des offres d'emploi
     */
    public Object getJobOfferStatistics() {
        long totalJobOffers = jobOfferRepository.count();
        long activeJobOffers = jobOfferRepository.countByStatus(JobOffer.JobStatus.ACTIVE);
        long closedJobOffers = jobOfferRepository.countByStatus(JobOffer.JobStatus.CLOSED);
        long draftJobOffers = jobOfferRepository.countByStatus(JobOffer.JobStatus.DRAFT);
        long expiredJobOffers = jobOfferRepository.countByStatus(JobOffer.JobStatus.EXPIRED);
        
        return new Object() {
            public final long total = totalJobOffers;
            public final long active = activeJobOffers;
            public final long closed = closedJobOffers;
            public final long draft = draftJobOffers;
            public final long expired = expiredJobOffers;
        };
    }

    /**
     * Méthode utilitaire pour mapper les données de la requête vers l'entité
     */
    private void mapRequestToEntity(JobOfferRequest request, JobOffer jobOffer) {
        jobOffer.setTitle(request.getTitle());
        jobOffer.setDescription(request.getDescription());
        jobOffer.setRequiredSkills(request.getRequiredSkills());
        jobOffer.setExperienceLevel(request.getExperienceLevel());
        jobOffer.setContractType(request.getContractType());
        jobOffer.setLocation(request.getLocation());
        jobOffer.setSalaryRange(request.getSalaryRange());
        jobOffer.setDeadline(request.getDeadline());
        
        if (request.getStatus() != null) {
            jobOffer.setStatus(request.getStatus());
        } else if (jobOffer.getStatus() == null) {
            jobOffer.setStatus(JobOffer.JobStatus.ACTIVE);
        }
    }
}

