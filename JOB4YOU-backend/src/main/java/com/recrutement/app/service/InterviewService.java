package com.recrutement.app.service;

import com.recrutement.app.dto.InterviewRequest;
import com.recrutement.app.dto.InterviewResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class InterviewService {

    @Autowired
    private InterviewRepository interviewRepository;

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    /**
     * Planifie un nouvel entretien
     */
    @Transactional
    public InterviewResponse scheduleInterview(InterviewRequest interviewRequest) {
        // Vérifier si le candidat existe
        Candidate candidate = candidateRepository.findById(interviewRequest.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + interviewRequest.getCandidateId()));

        // Vérifier si l'interviewer existe
        User interviewer = userRepository.findById(interviewRequest.getInterviewerId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec l'ID: " + interviewRequest.getInterviewerId()));

        // Créer l'entretien
        Interview interview = new Interview();
        mapRequestToEntity(interviewRequest, interview);
        interview.setCandidate(candidate);
        interview.setInterviewer(interviewer);
        interview.setCreatedAt(LocalDateTime.now());
        interview.setUpdatedAt(LocalDateTime.now());

        // Mettre à jour le statut du candidat si nécessaire
        updateCandidateStatus(candidate, interviewRequest.getType());

        Interview savedInterview = interviewRepository.save(interview);
        
        // Envoyer un e-mail d'invitation au candidat
        notificationService.sendInterviewInvitation(savedInterview);
        
        return new InterviewResponse(savedInterview);
    }

    /**
     * Récupère tous les entretiens
     */
    public List<InterviewResponse> getAllInterviews() {
        return interviewRepository.findAllWithRelations().stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère un entretien par son ID
     */
    public InterviewResponse getInterviewById(Long id) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        return new InterviewResponse(interview);
    }

    /**
     * Met à jour un entretien
     */
    @Transactional
    public InterviewResponse updateInterview(Long id, InterviewRequest interviewRequest) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));

        // Vérifier si le candidat existe
        if (!interview.getCandidate().getId().equals(interviewRequest.getCandidateId())) {
            Candidate candidate = candidateRepository.findById(interviewRequest.getCandidateId())
                    .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + interviewRequest.getCandidateId()));
            interview.setCandidate(candidate);
        }

        // Vérifier si l'interviewer existe
        if (!interview.getInterviewer().getId().equals(interviewRequest.getInterviewerId())) {
            User interviewer = userRepository.findById(interviewRequest.getInterviewerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec l'ID: " + interviewRequest.getInterviewerId()));
            interview.setInterviewer(interviewer);
        }

        mapRequestToEntity(interviewRequest, interview);
        interview.setUpdatedAt(LocalDateTime.now());

        Interview updatedInterview = interviewRepository.save(interview);
        return new InterviewResponse(updatedInterview);
    }

    /**
     * Supprime un entretien
     */
    @Transactional
    public void deleteInterview(Long id) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        interviewRepository.delete(interview);
    }

    /**
     * Récupère les entretiens d'un candidat
     */
    public List<InterviewResponse> getInterviewsByCandidate(Long candidateId) {
        return interviewRepository.findByCandidateId(candidateId).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les entretiens d'un interviewer
     */
    public List<InterviewResponse> getInterviewsByInterviewer(Long interviewerId) {
        return interviewRepository.findByInterviewerId(interviewerId).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les entretiens par statut
     */
    public List<InterviewResponse> getInterviewsByStatus(Interview.InterviewStatus status) {
        return interviewRepository.findByStatusWithRelations(status).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les entretiens par type
     */
    public List<InterviewResponse> getInterviewsByType(Interview.InterviewType type) {
        return interviewRepository.findByType(type).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les entretiens par période
     */
    public List<InterviewResponse> getInterviewsByDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return interviewRepository.findByInterviewDateBetween(startDate, endDate).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les entretiens d'un interviewer par période
     */
    public List<InterviewResponse> getInterviewsByInterviewerAndDateRange(Long interviewerId, LocalDateTime startDate, LocalDateTime endDate) {
        return interviewRepository.findByInterviewerIdAndInterviewDateBetween(interviewerId, startDate, endDate).stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Met à jour le statut d'un entretien
     */
    @Transactional
    public InterviewResponse updateInterviewStatus(Long id, Interview.InterviewStatus status) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));

        interview.setStatus(status);
        interview.setUpdatedAt(LocalDateTime.now());

        Interview updatedInterview = interviewRepository.save(interview);
        return new InterviewResponse(updatedInterview);
    }

    /**
     * Méthode utilitaire pour mapper les données de la requête vers l'entité
     */
    private void mapRequestToEntity(InterviewRequest request, Interview interview) {
        interview.setInterviewDate(request.getInterviewDate());
        interview.setType(request.getType());
        interview.setNotes(request.getNotes());
        interview.setDurationMinutes(request.getDurationMinutes());
        interview.setLocation(request.getLocation());
        
        if (request.getStatus() != null) {
            interview.setStatus(request.getStatus());
        } else if (interview.getStatus() == null) {
            interview.setStatus(Interview.InterviewStatus.SCHEDULED);
        }
    }

    /**
     * Met à jour le statut du candidat en fonction du type d'entretien
     */
    private void updateCandidateStatus(Candidate candidate, Interview.InterviewType interviewType) {
        switch (interviewType) {
            case PHONE_SCREENING:
                candidate.setStatus(Candidate.CandidateStatus.PHONE_SCREENING);
                break;
            case TECHNICAL:
                candidate.setStatus(Candidate.CandidateStatus.TECHNICAL_TEST);
                break;
            case HR:
            case MANAGER:
            case GROUP:
                candidate.setStatus(Candidate.CandidateStatus.INTERVIEW);
                break;
            case FINAL:
                candidate.setStatus(Candidate.CandidateStatus.FINAL_INTERVIEW);
                break;
        }
        candidate.setLastUpdated(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    /**
     * Récupère les entretiens d'un candidat par son email
     */
    public List<InterviewResponse> getInterviewsByEmail(String email) {
        System.out.println("[DEBUG] Recherche des entretiens pour l'email: " + email);
        List<Interview> interviews = interviewRepository.findByCandidateEmail(email);
        System.out.println("[DEBUG] Nombre d'entretiens trouvés: " + interviews.size());
        
        List<InterviewResponse> responses = interviews.stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
        
        System.out.println("[DEBUG] Réponses créées: " + responses.size());
        return responses;
    }
}

