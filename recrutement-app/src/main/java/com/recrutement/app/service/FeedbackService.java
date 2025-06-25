package com.recrutement.app.service;

import com.recrutement.app.dto.FeedbackRequest;
import com.recrutement.app.dto.FeedbackResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Feedback;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.FeedbackRepository;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FeedbackService {

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InterviewRepository interviewRepository;

    @Autowired
    private NotificationService notificationService;

    /**
     * Crée un nouveau feedback
     */
    @Transactional
    public FeedbackResponse createFeedback(FeedbackRequest feedbackRequest, String authorUsername) {
        // Vérifier si le candidat existe
        Candidate candidate = candidateRepository.findById(feedbackRequest.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + feedbackRequest.getCandidateId()));

        // Vérifier si l'auteur existe
        User author = userRepository.findByUsername(authorUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec le nom: " + authorUsername));

        // Vérifier si l'entretien existe (optionnel)
        Interview interview = null;
        if (feedbackRequest.getInterviewId() != null) {
            interview = interviewRepository.findById(feedbackRequest.getInterviewId())
                    .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + feedbackRequest.getInterviewId()));
        }

        // Créer le feedback
        Feedback feedback = new Feedback();
        mapRequestToEntity(feedbackRequest, feedback);
        feedback.setCandidate(candidate);
        feedback.setAuthor(author);
        feedback.setInterview(interview);
        feedback.setCreatedAt(LocalDateTime.now());
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback savedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(savedFeedback);
    }

    /**
     * Récupère tous les feedbacks
     */
    public List<FeedbackResponse> getAllFeedbacks() {
        return feedbackRepository.findAll().stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère un feedback par son ID
     */
    public FeedbackResponse getFeedbackById(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));
        return new FeedbackResponse(feedback);
    }

    /**
     * Met à jour un feedback
     */
    @Transactional
    public FeedbackResponse updateFeedback(Long id, FeedbackRequest feedbackRequest) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));

        mapRequestToEntity(feedbackRequest, feedback);
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback updatedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(updatedFeedback);
    }

    /**
     * Supprime un feedback
     */
    @Transactional
    public void deleteFeedback(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));
        feedbackRepository.delete(feedback);
    }

    /**
     * Récupère les feedbacks d'un candidat
     */
    public List<FeedbackResponse> getFeedbacksByCandidate(Long candidateId) {
        return feedbackRepository.findByCandidateId(candidateId).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks d'un auteur
     */
    public List<FeedbackResponse> getFeedbacksByAuthor(Long authorId) {
        return feedbackRepository.findByAuthorId(authorId).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks d'un entretien
     */
    public List<FeedbackResponse> getFeedbacksByInterview(Long interviewId) {
        return feedbackRepository.findByInterviewId(interviewId).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks par type
     */
    public List<FeedbackResponse> getFeedbacksByType(Feedback.FeedbackType type) {
        return feedbackRepository.findByType(type).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks par statut
     */
    public List<FeedbackResponse> getFeedbacksByStatus(Feedback.FeedbackStatus status) {
        return feedbackRepository.findByStatus(status).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks envoyés ou non envoyés aux candidats
     */
    public List<FeedbackResponse> getFeedbacksBySentStatus(Boolean isSentToCandidate) {
        return feedbackRepository.findByIsSentToCandidate(isSentToCandidate).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks d'un candidat par type
     */
    public List<FeedbackResponse> getFeedbacksByCandidateAndType(Long candidateId, Feedback.FeedbackType type) {
        return feedbackRepository.findByCandidateIdAndType(candidateId, type).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks d'une offre d'emploi
     */
    public List<FeedbackResponse> getFeedbacksByJobOffer(Long jobOfferId) {
        return feedbackRepository.findByJobOfferId(jobOfferId).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Approuve un feedback
     */
    @Transactional
    public FeedbackResponse approveFeedback(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));

        feedback.setStatus(Feedback.FeedbackStatus.APPROVED);
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback updatedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(updatedFeedback);
    }

    /**
     * Rejette un feedback
     */
    @Transactional
    public FeedbackResponse rejectFeedback(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));

        feedback.setStatus(Feedback.FeedbackStatus.REJECTED);
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback updatedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(updatedFeedback);
    }

    /**
     * Marque un feedback comme envoyé au candidat
     */
    @Transactional
    public FeedbackResponse markFeedbackAsSent(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));

        feedback.setIsSentToCandidate(true);
        feedback.setStatus(Feedback.FeedbackStatus.SENT);
        feedback.setSentAt(LocalDateTime.now());
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback updatedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(updatedFeedback);
    }

    /**
     * Met à jour le statut d'un feedback
     */
    @Transactional
    public FeedbackResponse updateFeedbackStatus(Long id, Feedback.FeedbackStatus status) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + id));

        feedback.setStatus(status);
        feedback.setUpdatedAt(LocalDateTime.now());

        Feedback updatedFeedback = feedbackRepository.save(feedback);
        return new FeedbackResponse(updatedFeedback);
    }

    /**
     * Récupère les feedbacks en attente d'approbation
     */
    public List<FeedbackResponse> getPendingFeedbacks() {
        return feedbackRepository.findByStatus(Feedback.FeedbackStatus.PENDING).stream()
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les feedbacks approuvés mais non envoyés
     */
    public List<FeedbackResponse> getApprovedNotSentFeedbacks() {
        return feedbackRepository.findByStatus(Feedback.FeedbackStatus.APPROVED).stream()
                .filter(feedback -> !feedback.getIsSentToCandidate())
                .map(FeedbackResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Envoie un feedback au candidat par e-mail
     */
    @Transactional
    public void sendFeedbackToCandidate(Long feedbackId) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + feedbackId));

        // Vérifier que le feedback est approuvé
        if (feedback.getStatus() != Feedback.FeedbackStatus.APPROVED) {
            throw new IllegalStateException("Le feedback doit être approuvé avant d'être envoyé");
        }

        // Envoyer l'e-mail
        notificationService.sendFeedbackNotification(feedback);

        // Mettre à jour le statut du feedback
        feedback.setIsSentToCandidate(true);
        feedback.setStatus(Feedback.FeedbackStatus.SENT);
        feedback.setSentAt(LocalDateTime.now());
        feedback.setUpdatedAt(LocalDateTime.now());

        feedbackRepository.save(feedback);
    }

    /**
     * Méthode utilitaire pour mapper les données de la requête vers l'entité
     */
    private void mapRequestToEntity(FeedbackRequest request, Feedback feedback) {
        feedback.setContent(request.getContent());
        feedback.setRating(request.getRating());
        feedback.setType(request.getType());
        
        if (request.getStatus() != null) {
            feedback.setStatus(request.getStatus());
        } else if (feedback.getStatus() == null) {
            feedback.setStatus(Feedback.FeedbackStatus.PENDING);
        }
        
        if (request.getIsSentToCandidate() != null) {
            feedback.setIsSentToCandidate(request.getIsSentToCandidate());
        } else if (feedback.getIsSentToCandidate() == null) {
            feedback.setIsSentToCandidate(false);
        }
    }

    /**
     * Envoie une notification détaillée au candidat
     */
    @Transactional
    public void sendDetailedNotification(Long feedbackId, com.recrutement.app.dto.DetailedNotificationRequest request) {
        Feedback feedback = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback non trouvé avec l'ID: " + feedbackId));
        
        if (feedback.getCandidate() == null) {
            throw new IllegalStateException("Le feedback doit être associé à un candidat");
        }

        // Envoyer la notification détaillée
        notificationService.sendDetailedFeedbackNotification(
            feedback.getCandidate().getId(),
            request.getSubject(),
            request.getMessage(),
            request.getInterviewDetails(),
            request.getFeedbackSummary()
        );

        // Mettre à jour le feedback
        feedback.setIsSentToCandidate(true);
        feedback.setStatus(Feedback.FeedbackStatus.SENT);
        feedback.setSentAt(LocalDateTime.now());
        feedback.setUpdatedAt(LocalDateTime.now());

        feedbackRepository.save(feedback);
    }

    /**
     * Récupère les statistiques des feedbacks
     */
    public Object getFeedbackStatistics() {
        long totalFeedbacks = feedbackRepository.count();
        long pendingFeedbacks = feedbackRepository.countByStatus(Feedback.FeedbackStatus.PENDING);
        long approvedFeedbacks = feedbackRepository.countByStatus(Feedback.FeedbackStatus.APPROVED);
        long rejectedFeedbacks = feedbackRepository.countByStatus(Feedback.FeedbackStatus.REJECTED);
        long sentFeedbacks = feedbackRepository.countByStatus(Feedback.FeedbackStatus.SENT);
        
        return new Object() {
            public final long total = totalFeedbacks;
            public final long pending = pendingFeedbacks;
            public final long approved = approvedFeedbacks;
            public final long rejected = rejectedFeedbacks;
            public final long sent = sentFeedbacks;
        };
    }
}

