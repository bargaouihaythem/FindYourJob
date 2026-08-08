package com.recrutement.app.service;

import com.recrutement.app.dto.InterviewRequest;
import com.recrutement.app.dto.InterviewResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.User;
import com.recrutement.app.entity.Role;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    @Autowired
    private N8nService n8nService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ReminderService reminderService;

    @Autowired
    private AccessControlService accessControlService;

    @Autowired
    private CandidateService candidateService;

    /**
     * Planifie un nouvel entretien
     */
    /** Statuts sur lesquels le dossier est clos négativement : aucun entretien ne doit plus être planifié. */
    private static final List<Candidate.CandidateStatus> CLOSED_NEGATIVE_STATUSES = List.of(
            Candidate.CandidateStatus.REJECTED,
            Candidate.CandidateStatus.AUTO_REJECTED,
            Candidate.CandidateStatus.MANAGER_REJECTED,
            Candidate.CandidateStatus.WITHDRAWN
    );

    @Transactional
    public InterviewResponse scheduleInterview(InterviewRequest interviewRequest) {
        // Vérifier si le candidat existe
        Candidate candidate = candidateRepository.findById(interviewRequest.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + interviewRequest.getCandidateId()));

        // Un dossier refusé (RH, manager ou IA) ou retiré est clos : aucun entretien ne doit être planifié dessus
        if (CLOSED_NEGATIVE_STATUSES.contains(candidate.getStatus())) {
            throw new IllegalArgumentException(
                    "Impossible de planifier un entretien : ce dossier est clos (statut " + candidate.getStatus() + ")");
        }
        // Le CV doit d'abord avoir été examiné par le RH : on ne planifie pas d'entretien
        // sur une candidature encore au stade "soumise" (garde-fou de la machine à états).
        if (candidate.getStatus() == Candidate.CandidateStatus.APPLIED) {
            throw new IllegalArgumentException(
                    "Le CV doit d'abord être examiné par le RH (CV_REVIEWED) avant de planifier un entretien");
        }

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
        Candidate.CandidateStatus statusBefore = candidate.getStatus();
        updateCandidateStatus(candidate, interviewRequest.getType());

        // Si la planification d'un entretien technique fait entrer le candidat en phase
        // technique pour la première fois, on transmet son dossier au(x) manager(s) —
        // cohérent avec le déclenchement depuis la fiche candidat (CandidateService).
        if (statusBefore != Candidate.CandidateStatus.TECHNICAL_TEST
                && candidate.getStatus() == Candidate.CandidateStatus.TECHNICAL_TEST) {
            candidateService.notifyManagersForTechnicalEvaluation(candidate);
        }

        Interview savedInterview = interviewRepository.save(interview);

        auditLogService.log("CANDIDATE", candidate.getId(), "INTERVIEW_SCHEDULED",
                null, interviewRequest.getType() + " le " + savedInterview.getInterviewDate());

        // Rappels automatiques : candidat J-1, interviewer H-2
        reminderService.createInterviewReminders(savedInterview);

        // Envoyer un e-mail d'invitation via Spring Mail
        notificationService.sendInterviewInvitation(savedInterview);

        // Déclencher l'Agent 3 n8n (Google Calendar + email enrichi) en arrière-plan
        n8nService.triggerAgent2InterviewScheduler(savedInterview);

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

        Interview.InterviewStatus previousStatus = interview.getStatus();
        interview.setStatus(status);
        interview.setUpdatedAt(LocalDateTime.now());

        Interview updatedInterview = interviewRepository.save(interview);

        // Notifier le candidat uniquement si le statut change réellement
        // (évite un email en double si l'admin re-soumet le même statut).
        if (status != previousStatus) {
            if (status == Interview.InterviewStatus.CANCELLED) {
                reminderService.cancelInterviewReminders(id);
                notificationService.sendInterviewCancellation(updatedInterview);
            } else if (status == Interview.InterviewStatus.RESCHEDULED) {
                notificationService.sendInterviewReschedule(updatedInterview);
            }
        }

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
        // Si le candidat est déjà ACCEPTED, l'entretien planifié → INTERVIEW_SCHEDULED
        if (candidate.getStatus() == Candidate.CandidateStatus.ACCEPTED) {
            candidate.setStatus(Candidate.CandidateStatus.INTERVIEW_SCHEDULED);
        } else {
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
        }
        candidate.setLastUpdated(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    /**
     * Récupère les entretiens d'un candidat par son email
     */
    public List<InterviewResponse> getInterviewsByEmail(String email) {
        accessControlService.assertOwnEmailOrPrivileged(email);
        System.out.println("[DEBUG] Recherche des entretiens pour l'email: " + email);
        List<Interview> interviews = interviewRepository.findByCandidateEmail(email);
        System.out.println("[DEBUG] Nombre d'entretiens trouvés: " + interviews.size());
        
        List<InterviewResponse> responses = interviews.stream()
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
        
        System.out.println("[DEBUG] Réponses créées: " + responses.size());
        return responses;
    }

    /**
     * Récupère la liste des interviewers (utilisateurs pouvant mener des entretiens)
     */
    public List<Map<String, Object>> getInterviewers() {
        // Récupérer tous les utilisateurs qui ont des rôles d'interviewer potentiels
        List<User> interviewers = userRepository.findAll().stream()
                .filter(user -> user.getRoles().stream()
                        .anyMatch(role -> 
                            role.getName() == Role.ERole.ROLE_HR ||
                            role.getName() == Role.ERole.ROLE_MANAGER ||
                            role.getName() == Role.ERole.ROLE_ADMIN ||
                            role.getName() == Role.ERole.ROLE_TEAM_LEAD ||
                            role.getName() == Role.ERole.ROLE_SENIOR_DEV ||
                            role.getName() == Role.ERole.ROLE_TEAM
                        )
                )
                .collect(Collectors.toList());
        
        return interviewers.stream()
                .map(this::mapUserToInterviewerResponse)
                .collect(Collectors.toList());
    }

    /**
     * Mappe un utilisateur vers un format de réponse pour les interviewers
     */
    private Map<String, Object> mapUserToInterviewerResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("name", generateDisplayName(user));
        response.put("role", getMainRoleDisplay(user));
        response.put("email", user.getEmail());
        return response;
    }

    /**
     * Génère le nom d'affichage pour un utilisateur
     */
    private String generateDisplayName(User user) {
        if (user.getFirstName() != null && user.getLastName() != null) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return user.getUsername();
    }

    /**
     * Récupère le rôle principal d'affichage pour un utilisateur
     */
    private String getMainRoleDisplay(User user) {
        // Priorité des rôles (du plus élevé au plus bas)
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_ADMIN)) {
            return "Administrateur";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_HR)) {
            return "RH Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_MANAGER)) {
            return "Manager";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_TEAM_LEAD)) {
            return "Tech Lead";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_SENIOR_DEV)) {
            return "Senior Developer";
        }
        if (user.getRoles().stream().anyMatch(role -> role.getName() == Role.ERole.ROLE_TEAM)) {
            return "Équipe";
        }
        return "Utilisateur";
    }
}

