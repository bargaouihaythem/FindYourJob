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
import java.util.regex.Pattern;
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

    /**
     * Dossiers définitivement tranchés par le RH : leurs entretiens ne sont plus modifiables.
     * {@code MANAGER_REJECTED} en est absent — c'est une proposition, pas une décision — et le
     * manager doit pouvoir y clôturer l'entretien qui a produit refus.
     */
    private static final List<Candidate.CandidateStatus> DOSSIER_DECIDED_STATUSES = List.of(
            Candidate.CandidateStatus.HIRED,
            Candidate.CandidateStatus.REJECTED,
            Candidate.CandidateStatus.AUTO_REJECTED,
            Candidate.CandidateStatus.WITHDRAWN
    );

    /** Durée retenue quand la requête n'en indique pas : celle du formulaire d'origine. */
    private static final int DEFAULT_DURATION_MINUTES = 60;

    /**
     * Statuts qui réservent l'agenda de l'intervieweur : seule une annulation libère le créneau.
     * COMPLETED compte comme pris, et RESCHEDULED garde la date courante de la ligne — c'est bien
     * elle qui bloque désormais l'intervieweur.
     */
    private static final List<Interview.InterviewStatus> BOOKING_STATUSES = List.of(
            Interview.InterviewStatus.SCHEDULED,
            Interview.InterviewStatus.IN_PROGRESS,
            Interview.InterviewStatus.COMPLETED,
            Interview.InterviewStatus.RESCHEDULED
    );

    /** Lieux qui désignent un échange à distance, donc ayant besoin d'une salle virtuelle. */
    private static final Pattern LIEU_A_DISTANCE = Pattern.compile(
            "visio|distant|en ligne|remote|meet|teams|zoom", Pattern.CASE_INSENSITIVE);

    @Transactional
    public InterviewResponse scheduleInterview(InterviewRequest interviewRequest) {
        // Vérifier si le candidat existe
        Candidate candidate = candidateRepository.findById(interviewRequest.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + interviewRequest.getCandidateId()));

        // Un manager ne peut planifier un entretien que pour un dossier de son périmètre.
        accessControlService.assertCanAccessCandidate(candidate);

        // Un dossier refusé (RH, manager ou IA) ou retiré est clos : aucun entretien ne doit être planifié dessus
        if (CLOSED_NEGATIVE_STATUSES.contains(candidate.getStatus())) {
            throw new IllegalArgumentException(
                    "Impossible de planifier un entretien : ce dossier est clos (statut " + candidate.getStatus() + ")");
        }
        // Un dossier embauché est clos, mais positivement : la liste ci-dessus ne couvre que
        // les issues négatives, et un entretien pouvait encore être posé sur un candidat HIRED
        // (nouvelle invitation + doublon de convocation côté e-mails).
        if (candidate.getStatus() == Candidate.CandidateStatus.HIRED) {
            throw new IllegalArgumentException(
                    "Ce candidat est embauché : la planification d'un entretien est fermée.");
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

        // Un manager qui planifie ne le fait que pour son propre agenda.
        assertInterviewerAssignmentAllowed(interviewer);

        // Deux rendez-vous en même temps, c'est physiquement impossible — même le même jour.
        assertNoOverlapWithInterviewerAgenda(interviewer.getId(), interviewRequest.getInterviewDate(),
                interviewRequest.getDurationMinutes(), null);

        // Créer l'entretien
        Interview interview = new Interview();
        mapRequestToEntity(interviewRequest, interview);
        interview.setCandidate(candidate);
        interview.setInterviewer(interviewer);
        interview.setCreatedAt(LocalDateTime.now());
        interview.setUpdatedAt(LocalDateTime.now());

        // Planifier l'entretien est d'abord un acte d'agenda — mais cet agenda est l'étape du
        // pipeline en cours : le dossier passe donc à l'étape correspondant au type planifié,
        // dans la même transaction. La machine à états (CandidateService) garde la main : une
        // avancée qu'elle refuse laisse le dossier où il est, sans jamais annuler l'entretien.
        Interview savedInterview = interviewRepository.save(interview);

        // Un entretien à distance porte toujours une salle, dès sa création : ce lien est
        // produit par la plateforme, sans dépendance à un jeton Google. L'agent n8n se
        // contente de le remplacer par un lien Google Meet authentique quand l'API Calendar
        // répond ; quand elle ne répond pas (OAuth expiré), candidat et interviewer ont déjà
        // de quoi se rejoindre et l'e-mail d'invitation part avec le lien.
        savedInterview = avecSalleParDefaut(savedInterview);

        candidateService.advanceForScheduledInterview(
                candidate.getId(), candidateStatusForType(savedInterview.getType()),
                "Entretien " + labelForType(savedInterview.getType()) + " planifié le "
                        + savedInterview.getInterviewDate());

        auditLogService.log("CANDIDATE", candidate.getId(), "INTERVIEW_SCHEDULED",
                null, savedInterview.getType() + " le " + savedInterview.getInterviewDate());

        // Rappels automatiques : candidat J-1, interviewer H-2
        reminderService.createInterviewReminders(savedInterview);

        // Envoyer un e-mail d'invitation via Spring Mail — seulement si l'Agent 2 ne prend
        // pas la main : quand son webhook est configuré, c'est lui qui adresse la convocation
        // (avec le lien de visio) au candidat et l'e-mail au interviewer. Les deux canaux
        // ensemble doublonnaient la notification dans la boîte du candidat.
        if (!n8nService.isAgent2Configured()) {
            notificationService.sendInterviewInvitation(savedInterview);
        }

        // Déclencher l'Agent 3 n8n (Google Calendar + email enrichi) en arrière-plan
        n8nService.triggerAgent2InterviewScheduler(savedInterview);

        return new InterviewResponse(savedInterview);
    }

    /**
     * Dote l'entretien d'une salle de visio gérée par la plateforme s'il se tient à distance
     * et qu'aucun lien n'a été saisi. Retourne l'entité telle quelle pour un entretien sur
     * site — un lien de visio y serait un faux signal.
     */
    private Interview avecSalleParDefaut(Interview interview) {
        String lieu = interview.getLocation();
        boolean aDistance = lieu != null && LIEU_A_DISTANCE.matcher(lieu).find();
        boolean sansLien = interview.getMeetLink() == null || interview.getMeetLink().isBlank();
        if (!aDistance || !sansLien) {
            return interview;
        }
        interview.setMeetLink("https://meet.jit.si/Job4You-" + interview.getId()
                + "-" + interview.getInterviewDate().toLocalDate());
        return interviewRepository.save(interview);
    }

    /**
     * Étape de pipeline que représente un type d'entretien planifié. Le mapping est volontaire
     * identique à celui que faisait le frontend : la différence est qu'il est maintenant appliqué
     * par le serveur, donc sous le contrôle de la machine à états et quelle que soit la voie
     * d'appel (ihm, API, rappel n8n).
     */
    private Candidate.CandidateStatus candidateStatusForType(Interview.InterviewType type) {
        if (type == null) {
            return null;
        }
        switch (type) {
            case PHONE_SCREENING:
                return Candidate.CandidateStatus.PHONE_SCREENING;
            case TECHNICAL:
                return Candidate.CandidateStatus.TECHNICAL_TEST;
            case FINAL:
                return Candidate.CandidateStatus.FINAL_INTERVIEW;
            case HR:
            case MANAGER:
            case GROUP:
                return Candidate.CandidateStatus.INTERVIEW;
            default:
                return null;
        }
    }

    private String labelForType(Interview.InterviewType type) {
        if (type == null) {
            return "";
        }
        switch (type) {
            case PHONE_SCREENING: return "téléphonique";
            case TECHNICAL: return "technique";
            case HR: return "RH";
            case MANAGER: return "avec le manager";
            case FINAL: return "final";
            case GROUP: return "de groupe";
            default: return type.name();
        }
    }

    /**
     * Récupère tous les entretiens
     */
    public List<InterviewResponse> getAllInterviews() {
        return toScopedResponses(interviewRepository.findAllWithRelations());
    }

    /**
     * Calendrier dédié au manager courant : uniquement les entretiens dont il est
     * l'intervieweur, et uniquement parmi les dossiers de son périmètre (même règle
     * que la visibilité des dossiers). Le frontend ne décide jamais du périmètre.
     */
    public List<InterviewResponse> getManagerCalendar(LocalDateTime startDate, LocalDateTime endDate) {
        Long currentUserId = accessControlService.currentUserId();
        if (currentUserId == null) {
            return List.of();
        }
        List<Interview> interviews = startDate != null && endDate != null
                ? interviewRepository.findInRangeWithRelations(startDate, endDate)
                : interviewRepository.findAllWithRelations();
        return interviews.stream()
                .filter(interview -> interview != null && interview.getCandidate() != null)
                .filter(interview -> interview.getInterviewer() != null
                        && currentUserId.equals(interview.getInterviewer().getId()))
                .filter(interview -> accessControlService.canAccessCandidate(interview.getCandidate()))
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    private List<InterviewResponse> toScopedResponses(List<Interview> interviews) {
        return interviews.stream()
                .filter(interview -> interview != null && interview.getCandidate() != null)
                .filter(interview -> accessControlService.canAccessCandidate(interview.getCandidate()))
                .map(InterviewResponse::new)
                .collect(Collectors.toList());
    }

    private void assertCanAccessInterview(Interview interview) {
        accessControlService.assertCanAccessCandidate(interview.getCandidate());
    }

    /**
     * Un manager « pur » (sans rôle RH/Admin) ne peut confier un entretien qu'à lui-même :
     * l'affecter à un pair ferait apparaître la ligne dans un agenda qu'il ne pilote pas et
     * disparaître la sienne. Réutiliser l'intervieweur déjà enregistré (simple reprogrammation)
     * reste autorisé — seul un changement d'intervieweur est refusé.
     */
    private void assertInterviewerAssignmentAllowed(User interviewer) {
        if (!accessControlService.currentIsPureManager()) {
            return;
        }
        Long currentUserId = accessControlService.currentUserId();
        if (currentUserId == null || !currentUserId.equals(interviewer.getId())) {
            throw new IllegalArgumentException(
                    "Vous ne pouvez planifier un entretien que pour vous-même : sélectionnez votre compte comme intervieweur.");
        }
    }

    /**
     * Refuse un créneau qui en chevauche un déjà réservé par le même intervieweur.
     * Plusieurs entretiens le même jour restent autorisés : ce qui est physiquement impossible,
     * c'est d'être à deux rendez-vous en même temps. Sans ce contrôle, l'agent n8n pose deux
     * événements Google qui se recouvrent et le second candidat reçoit une invitation pour un
     * créneau où son intervieweur est déjà pris.
     *
     * @param excludedId un entretien en cours de modification ne doit pas se chevaucher lui-même
     */
    private void assertNoOverlapWithInterviewerAgenda(Long interviewerId, LocalDateTime start,
                                                     Integer durationMinutes, Long excludedId) {
        if (interviewerId == null || start == null) {
            return;
        }
        LocalDateTime end = start.plusMinutes(resolveDuration(durationMinutes));
        // Fenêtre volontairement large : un entretien de la veille au soir ou du lendemain matin
        // peut chevaucher une fin / un début de journée.
        List<Interview> surroundings = interviewRepository.findByInterviewerIdAndInterviewDateBetween(
                interviewerId, start.minusDays(1), start.plusDays(1));

        for (Interview other : surroundings) {
            if (other.getId().equals(excludedId) || !BOOKING_STATUSES.contains(other.getStatus())) {
                continue;
            }
            LocalDateTime otherEnd = other.getInterviewDate().plusMinutes(resolveDuration(other.getDurationMinutes()));
            if (start.isBefore(otherEnd) && other.getInterviewDate().isBefore(end)) {
                throw new IllegalArgumentException("Ce créneau chevauche un entretien déjà planifié avec "
                        + candidateLabel(other) + " (" + other.getInterviewDate().toLocalDate()
                        + " " + other.getInterviewDate().toLocalTime() + ", "
                        + resolveDuration(other.getDurationMinutes()) + " min). "
                        + "Plusieurs entretiens le même jour sont possibles, mais pas en même temps : "
                        + "choisissez un autre horaire.");
            }
        }
    }

    private int resolveDuration(Integer durationMinutes) {
        return durationMinutes == null || durationMinutes <= 0
                ? DEFAULT_DURATION_MINUTES : durationMinutes;
    }

    private String candidateLabel(Interview interview) {
        Candidate candidate = interview.getCandidate();
        if (candidate == null) {
            return "un autre candidat";
        }
        String fullName = (candidate.getFirstName() + " " + candidate.getLastName()).trim();
        return fullName.isEmpty() ? "Candidat " + candidate.getId() : fullName;
    }

    /**
     * Récupère un entretien par son ID
     */
    public InterviewResponse getInterviewById(Long id) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        assertCanAccessInterview(interview);
        return new InterviewResponse(interview);
    }

    /**
     * Met à jour un entretien
     */
    @Transactional
    public InterviewResponse updateInterview(Long id, InterviewRequest interviewRequest) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        assertCanAccessInterview(interview);

        // Vérifier si le candidat existe
        if (!interview.getCandidate().getId().equals(interviewRequest.getCandidateId())) {
            Candidate candidate = candidateRepository.findById(interviewRequest.getCandidateId())
                    .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + interviewRequest.getCandidateId()));
            accessControlService.assertCanAccessCandidate(candidate);
            interview.setCandidate(candidate);
        }

        // Vérifier si l'interviewer existe
        if (!interview.getInterviewer().getId().equals(interviewRequest.getInterviewerId())) {
            User interviewer = userRepository.findById(interviewRequest.getInterviewerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec l'ID: " + interviewRequest.getInterviewerId()));
            assertInterviewerAssignmentAllowed(interviewer);
            interview.setInterviewer(interviewer);
        }

        mapRequestToEntity(interviewRequest, interview);
        interview.setUpdatedAt(LocalDateTime.now());

        // Déplacer un entretien sur son propre créneau n'est pas un conflit : c'est le cas normal
        // d'une simple correction de durée, d'où l'identité exclue de la comparaison.
        assertNoOverlapWithInterviewerAgenda(interview.getInterviewer().getId(),
                interviewRequest.getInterviewDate(), interviewRequest.getDurationMinutes(), id);

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
        assertCanAccessInterview(interview);
        interviewRepository.delete(interview);
    }

    /**
     * Récupère les entretiens d'un candidat
     */
    public List<InterviewResponse> getInterviewsByCandidate(Long candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + candidateId));
        accessControlService.assertCanAccessCandidate(candidate);
        return toScopedResponses(interviewRepository.findByCandidateId(candidateId));
    }

    /**
     * Récupère les entretiens d'un interviewer
     */
    public List<InterviewResponse> getInterviewsByInterviewer(Long interviewerId) {
        return toScopedResponses(interviewRepository.findByInterviewerId(interviewerId));
    }

    /**
     * Récupère les entretiens par statut
     */
    public List<InterviewResponse> getInterviewsByStatus(Interview.InterviewStatus status) {
        return toScopedResponses(interviewRepository.findByStatusWithRelations(status));
    }

    /**
     * Récupère les entretiens par type
     */
    public List<InterviewResponse> getInterviewsByType(Interview.InterviewType type) {
        return toScopedResponses(interviewRepository.findByType(type));
    }

    /**
     * Récupère les entretiens par période
     */
    public List<InterviewResponse> getInterviewsByDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return toScopedResponses(interviewRepository.findByInterviewDateBetween(startDate, endDate));
    }

    /**
     * Récupère les entretiens d'un interviewer par période
     */
    public List<InterviewResponse> getInterviewsByInterviewerAndDateRange(Long interviewerId, LocalDateTime startDate, LocalDateTime endDate) {
        return toScopedResponses(interviewRepository.findByInterviewerIdAndInterviewDateBetween(interviewerId, startDate, endDate));
    }

    /**
     * Met à jour le statut d'un entretien
     */
    @Transactional
    public InterviewResponse updateInterviewStatus(Long id, Interview.InterviewStatus status) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        assertCanAccessInterview(interview);

        Interview.InterviewStatus previousStatus = interview.getStatus();

        // Un dossier déjà tranché n'a plus d'entretien à rejouer. Sans ce garde, le manager
        // peut relancer un créneau clos — et déclencher par exemple un e-mail d'annulation
        // chez un candidat que le RH vient d'embaucher.
        Candidate.CandidateStatus dossierStatus = interview.getCandidate().getStatus();
        if (status != previousStatus && DOSSIER_DECIDED_STATUSES.contains(dossierStatus)) {
            throw new IllegalArgumentException(
                    "Cet entretien est rattaché à un dossier déjà tranché (" + dossierStatus
                    + ") : il n'est plus modifiable. Adressez-vous au RH.");
        }
        // Rouvrir un entretien clôturé n'appartient qu'au RH : le manager qui a tenu son
        // rendez-vous ne peut pas en effacer la clôture.
        if (previousStatus == Interview.InterviewStatus.COMPLETED
                && status != Interview.InterviewStatus.COMPLETED
                && accessControlService.currentIsPureManager()) {
            throw new IllegalArgumentException(
                    "Cet entretien est déjà marqué comme effectué : seul le RH peut le rouvrir.");
        }

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
     * Enregistre le lien Google Meet réel, transmis par l'agent n8n après création
     * de l'événement dans Google Calendar. Pas de contrôle de périmètre ici : cet
     * endpoint est déjà protégé au niveau du contrôleur par le rôle N8N, sur le
     * même modèle que CandidateService.saveAiScore.
     */
    @Transactional
    public InterviewResponse saveMeetLink(Long id, String meetLink) {
        Interview interview = interviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entretien non trouvé avec l'ID: " + id));
        // Un lien vide ou tronqué effacerait la salle par défaut déjà publiée : le callback
        // de l'agent ne peut qu'améliorer le lien, jamais le retirer.
        if (meetLink == null || !meetLink.startsWith("http")) {
            return new InterviewResponse(interview);
        }
        interview.setMeetLink(meetLink);
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
     * Récupère les entretiens d'un candidat par son email
     */
    public List<InterviewResponse> getInterviewsByEmail(String email) {
        accessControlService.assertOwnEmailOrPrivileged(email);
        System.out.println("[DEBUG] Recherche des entretiens pour l'email: " + email);
        List<Interview> interviews = interviewRepository.findByCandidateEmail(email);
        System.out.println("[DEBUG] Nombre d'entretiens trouvés: " + interviews.size());
        
        List<InterviewResponse> responses = toScopedResponses(interviews);
        
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

