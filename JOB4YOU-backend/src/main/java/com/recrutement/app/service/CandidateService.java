package com.recrutement.app.service;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.dto.RoutingStatusResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.N8nOutboxEvent;
import com.recrutement.app.entity.RoutingBasis;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.repository.CandidateRepository;
import com.recrutement.app.repository.JobOfferRepository;
import com.recrutement.app.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    @Autowired
    private N8nService n8nService;

    @Autowired
    private AiScoringService aiScoringService;

    @Autowired
    private CvTextExtractionService cvTextExtractionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ManagerRoutingService managerRoutingService;

    @Autowired
    private ManagerScopeService managerScopeService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private AccessControlService accessControlService;

    @Autowired
    private N8nOutboxService n8nOutboxService;

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
        cv.setExtractedText(cvTextExtractionService.extractText(
                java.nio.file.Paths.get(cv.getFilePath()), cv.getContentType()));

        cvRepository.save(cv);

        // Lier le CV au candidat en mémoire pour que l'Agent 1 reçoive l'URL du CV
        savedCandidate.setCv(cv);

        // Un seul système envoie l’accusé de réception : Agent 1 n8n si
        // configuré, sinon Spring Boot assure le fallback local.
        if (!n8nService.isAgent1Configured()) {
            notificationService.sendApplicationConfirmation(savedCandidate);
        }

        // Déclencher l’Agent 1 n8n (CV Parser + scoring IA) en arrière-plan
        n8nService.triggerAgent1CvParser(savedCandidate);

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
        List<Candidate> candidates = scopeToCurrentManager(candidateRepository.findAllWithCV());
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
        assertCurrentUserCanActOn(candidate);
        return new CandidateResponse(candidate);
    }

    /**
     * Récupère l'entité candidat brute (usage interne : génération de rapport PDF).
     */
    public Candidate getCandidateEntityById(Long id) {
        return candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
    }

    /**
     * Où le dossier part s'il est transmis maintenant : destinataires et niveau de la
     * chaîne qui les a trouvés. Un dossier déjà transmis garde sa destination gelée,
     * l'aperçu montre donc les vrais destinataires et non une nouvelle résolution.
     * Pure lecture : aucune notification, aucun envoi.
     */
    public ManagerRoutingService.RoutingResult routingPreview(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        accessControlService.assertCanAccessCandidate(candidate);

        if (candidate.getRoutedManagerEmails() != null && !candidate.getRoutedManagerEmails().isBlank()) {
            List<ManagerRoutingService.RoutedManager> frozen = java.util.Arrays
                    .stream(candidate.getRoutedManagerEmails().split(","))
                    .map(String::trim)
                    .filter(email -> !email.isEmpty())
                    .map(email -> userRepository.findByEmail(email)
                            .map(ManagerRoutingService.RoutedManager::of)
                            .orElseGet(() -> new ManagerRoutingService.RoutedManager(null, email, email)))
                    .collect(Collectors.toList());
            return new ManagerRoutingService.RoutingResult(frozen, candidate.getRoutingBasis());
        }
        return managerRoutingService.resolve(candidate.getJobOffer());
    }

    /**
     * Trace RH d'une transmission : destinataires gelés, critère d'aiguillage, et pour
     * chacun l'état de la notification dans l'outbox (PENDING / SENT / FAILED, nombre
     * de tentatives, erreur éventuelle, relances déjà demandées).
     *
     * « SENT » signifie que le webhook n8n a accepté l'événement. La plateforme ne
     * trace pas l'ouverture de l'e-mail ni sa remise dans la boîte du manager : c'est
     * la frontière de ce qui est vérifiable ici, et le texte du bloc RH doit le dire.
     */
    @Transactional(readOnly = true)
    public RoutingStatusResponse routingStatus(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        accessControlService.assertCanAccessCandidate(candidate);
        return buildRoutingStatus(candidate);
    }

    private RoutingStatusResponse buildRoutingStatus(Candidate candidate) {
        Map<String, List<N8nOutboxEvent>> eventsByEmail = routingEventsByRecipient(candidate.getId());

        List<RoutingStatusResponse.RecipientNotification> recipients = new java.util.ArrayList<>();
        for (String email : frozenRoutingEmails(candidate)) {
            N8nOutboxEvent latest = null;
            int retries = 0;
            for (N8nOutboxEvent event : eventsByEmail.getOrDefault(email, List.of())) {
                if (eventKeyRetry(event.getEventKey()) > 0) {
                    retries++;
                }
                if (latest == null || !event.getCreatedAt().isBefore(latest.getCreatedAt())) {
                    latest = event;
                }
            }
            RoutingStatusResponse.RecipientNotification recipient =
                    new RoutingStatusResponse.RecipientNotification();
            recipient.setEmail(email);
            recipient.setFullName(userRepository.findByEmail(email)
                    .map(ManagerRoutingService.RoutedManager::of)
                    .map(ManagerRoutingService.RoutedManager::fullName)
                    .orElse(email));
            recipient.setRetries(retries);
            if (latest == null) {
                recipient.setNotificationStatus("NOT_ENQUEUED");
                recipient.setAttempts(0);
            } else {
                recipient.setNotificationStatus(latest.getStatus().name());
                recipient.setAttempts(latest.getAttempts());
                recipient.setSentAt(latest.getSentAt());
                recipient.setNextAttemptAt(latest.getNextAttemptAt());
                recipient.setLastError(latest.getLastError());
            }
            recipients.add(recipient);
        }

        RoutingBasis basis = candidate.getRoutingBasis();
        return new RoutingStatusResponse(candidate.getId(), candidate.getStatus().name(),
                candidate.getRoutedAt(), basis == null ? null : basis.name(),
                basis == null ? null : ROUTING_BASIS_LABELS.getOrDefault(basis, basis.name()),
                !recipients.isEmpty(), recipients);
    }

    /**
     * Relance la notification des destinataires **gelés** du dossier. Le RH peut ainsi
     * corriger une échec de notification sans repasser par la machine à états, et sans
     * risquer de modifier la destination.
     *
     * La relance passe par une clé d'outbox inédite (« :retry-N ») : renvoyer la clé
     * d'origine serait ignoré en silence par la déduplication, ce qui donnerait au RH
     * un bouton qui ne fait rien.
     */
    @Transactional
    public RoutingStatusResponse rerouteNotification(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        List<String> emails = frozenRoutingEmails(candidate);
        if (emails.isEmpty()) {
            throw new IllegalArgumentException(
                    "Aucune transmission à relancer : ce dossier n'a pas encore été transmis à un manager.");
        }

        String offerTitle = candidate.getJobOffer() != null
                ? candidate.getJobOffer().getTitle() : "Candidature générale";
        String cvUrl = candidate.getCv() != null ? candidate.getCv().getFileUrl() : null;

        Map<String, List<N8nOutboxEvent>> eventsByEmail = routingEventsByRecipient(candidate.getId());
        List<String> relaunched = new java.util.ArrayList<>();
        List<String> notEnqueued = new java.util.ArrayList<>();
        for (String email : emails) {
            List<N8nOutboxEvent> events = eventsByEmail.getOrDefault(email, List.of());
            // On repart du statut métier enregistré à la transmission, pas du statut
            // actuel : sinon la relance créerait un événement pour un autre instantané.
            String statusAtSend = events.isEmpty() ? candidate.getStatus().name()
                    : eventKeyStatus(events.get(events.size() - 1).getEventKey());
            int nextRetry = 0;
            for (N8nOutboxEvent event : events) {
                nextRetry = Math.max(nextRetry, eventKeyRetry(event.getEventKey()));
            }
            String key = n8nService.retryAgent3HrValidation(candidate.getId(), candidate.getEmail(),
                    candidate.getFirstName(), candidate.getLastName(), offerTitle, cvUrl,
                    statusAtSend, email, "RH relance", nextRetry + 1);
            if (key != null) {
                relaunched.add(email);
            } else {
                notEnqueued.add(email);
            }
        }

        auditLogService.log("CANDIDATE", candidate.getId(), "ROUTING_RETRY",
                "Transmis le " + ROUTED_AT_FORMAT.format(candidate.getRoutedAt()),
                relaunched.isEmpty()
                        ? "Aucune relance possible : le webhook Agent 3 n'est pas configuré "
                          + "(n8n.webhook.agent3 dans application.properties)"
                        : "Relance manuelle notifiée à : " + String.join(", ", relaunched));

        return buildRoutingStatus(candidate);
    }

    /** Destinataires figés sur le dossier, dans l'ordre de la transmission. */
    private List<String> frozenRoutingEmails(Candidate candidate) {
        String stored = candidate.getRoutedManagerEmails();
        if (stored == null || stored.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(stored.split(","))
                .map(String::trim)
                .filter(email -> !email.isEmpty())
                .collect(Collectors.toList());
    }

    /** Événements de l'outbox de ce dossier, regroupés par destinataire. */
    private Map<String, List<N8nOutboxEvent>> routingEventsByRecipient(Long candidateId) {
        Map<String, List<N8nOutboxEvent>> byEmail = new java.util.LinkedHashMap<>();
        for (N8nOutboxEvent event : n8nOutboxService.findRoutingEvents(candidateId)) {
            String email = eventKeyEmail(event.getEventKey());
            if (email != null) {
                byEmail.computeIfAbsent(email, k -> new java.util.ArrayList<>()).add(event);
            }
        }
        return byEmail;
    }

    /** « 69:DOSSIER_VALIDE_RH:TECHNICAL_TEST:manager@x.com:retry-2 » → l'adresse. */
    private static String eventKeyEmail(String eventKey) {
        String[] parts = eventKeyParts(eventKey);
        return parts != null && parts.length >= 2 ? parts[1] : null;
    }

    private static String eventKeyStatus(String eventKey) {
        String[] parts = eventKeyParts(eventKey);
        return parts != null && parts.length >= 1 ? parts[0] : null;
    }

    private static int eventKeyRetry(String eventKey) {
        String[] parts = eventKeyParts(eventKey);
        if (parts == null || parts.length < 3 || !parts[2].startsWith("retry-")) {
            return 0;
        }
        try {
            return Integer.parseInt(parts[2].substring("retry-".length()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** [statut, destinataire, relance] après le préfixe commun, null si la clé n'est pas une transmission. */
    private static String[] eventKeyParts(String eventKey) {
        if (eventKey == null || !eventKey.contains(":DOSSIER_VALIDE_RH:")) {
            return null;
        }
        int start = eventKey.indexOf(":DOSSIER_VALIDE_RH:") + ":DOSSIER_VALIDE_RH:".length();
        return eventKey.substring(start).split(":", 3);
    }

    /**
     * Met à jour un candidat
     */
    @Transactional
    public CandidateResponse updateCandidate(Long id, CandidateRequest candidateRequest) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        assertCurrentUserCanActOn(candidate);

        candidate.setFirstName(candidateRequest.getFirstName());
        candidate.setLastName(candidateRequest.getLastName());
        candidate.setEmail(candidateRequest.getEmail());
        candidate.setPhone(candidateRequest.getPhone());
        candidate.setAddress(candidateRequest.getAddress());
        candidate.setLinkedinProfile(candidateRequest.getLinkedinProfile());
        candidate.setCoverLetter(candidateRequest.getCoverLetter());
        
        // Le statut ne peut pas être modifié par l’endpoint générique :
        // il doit passer par updateCandidateStatus/managerDecision afin que
        // la machine à états, l’audit et les notifications soient appliqués.
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
        assertCurrentUserCanActOn(candidate);

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
        return scopeToCurrentManager(candidateRepository.findByJobOfferIdWithDetails(jobOfferId)).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Récupère les candidats par offre d'emploi avec pagination
     */
    public Page<CandidateResponse> getCandidatesByJobOffer(Long jobOfferId, Pageable pageable) {
        // Pagination réalisée après filtrage de périmètre : les datasets manager restent
        // petits dans cette application, le coût du chargement complet est négligeable.
        List<Candidate> scoped = scopeToCurrentManager(
                candidateRepository.findByJobOfferId(jobOfferId, Pageable.unpaged()).getContent());
        List<CandidateResponse> responses = scoped.stream().map(CandidateResponse::new).toList();
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), responses.size());
        List<CandidateResponse> pageContent = start >= end ? List.of() : responses.subList(start, end);
        return new org.springframework.data.domain.PageImpl<>(pageContent, pageable, responses.size());
    }

    /**
     * Récupère les candidats par statut
     */
    public List<CandidateResponse> getCandidatesByStatus(Candidate.CandidateStatus status) {
        return scopeToCurrentManager(candidateRepository.findByStatus(status)).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Vue Manager : retourne uniquement les dossiers transmis au manager pour évaluation
     * technique, c'est-à-dire ceux ayant franchi le pré-filtrage téléphonique du RH.
     *
     * RESPONSABILITÉ RH      : réception, examen du CV, entretien téléphonique
     * RESPONSABILITÉ MANAGER : évaluation technique, feedback, décision finale
     *
     * Statuts inclus : TECHNICAL_TEST, INTERVIEW, FINAL_INTERVIEW, ACCEPTED
     * Statuts exclus : APPLIED, CV_REVIEWED, PHONE_SCREENING (encore côté RH),
     *                  ainsi que REJECTED / WITHDRAWN.
     *
     * Scope : un utilisateur avec UNIQUEMENT le rôle MANAGER ne voit que les dossiers
     * qui lui sont destinataires — la liste gelée à la transmission, sinon la résolution
     * actuelle de son offre (ManagerScopeService). RH/Admin (même s'ils cumulent le rôle
     * MANAGER) voient tout.
     */
    public List<CandidateResponse> getValidatedCandidatesForManager(String username) {
        List<Candidate.CandidateStatus> validatedStatuses = List.of(
                Candidate.CandidateStatus.TECHNICAL_TEST,
                Candidate.CandidateStatus.INTERVIEW,
                Candidate.CandidateStatus.FINAL_INTERVIEW,
                Candidate.CandidateStatus.ACCEPTED
        );

        List<Candidate> candidates;
        User currentUser = username != null ? userRepository.findByUsername(username).orElse(null) : null;
        boolean isPrivileged = currentUser != null && currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_HR || r.getName() == Role.ERole.ROLE_ADMIN);

        if (currentUser == null || isPrivileged) {
            // RH/Admin (ou appel système) : vue complète, non filtrée
            candidates = candidateRepository.findByStatusIn(validatedStatuses);
        } else {
            // MANAGER seul : uniquement les dossiers dont il est destinataire
            candidates = candidateRepository.findByStatusIn(validatedStatuses).stream()
                    .filter(c -> managerScopeService.isRecipient(c, currentUser))
                    .collect(Collectors.toList());
        }

        return candidates.stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Recherche des candidats par nom
     */
    public List<CandidateResponse> searchCandidatesByName(String name) {
        return scopeToCurrentManager(candidateRepository.findByFirstNameOrLastNameContaining(name)).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Met à jour le statut d'un candidat.
     *
     * Responsabilités :
     *   RH          → valide administrativement (ex. CV_REVIEWED) via PATCH /candidates/{id}/status
     *   Spring Boot → persiste le nouveau statut, déclenche Agent 2 si validation RH
     *   n8n Agent 2 → notifie le manager, envoie le dossier, relance si nécessaire
     */
    public CandidateResponse updateCandidateStatus(Long id, Candidate.CandidateStatus status) {
        return updateCandidateStatus(id, status, null);
    }

    @Transactional
    public CandidateResponse updateCandidateStatus(Long id, Candidate.CandidateStatus status, String reason) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        assertCurrentUserCanActOn(candidate);

        // Un manager « pur » (rôle MANAGER sans RH/Admin) ne pilote pas le pipeline : son
        // périmètre d'écriture est la seule décision finale (ACCEPTED / MANAGER_REJECTED).
        User actingManager = getCurrentNonPrivilegedManager();

        // REJECTED envoyé par le frontend :
        //  - porteur = manager « pur »  → MANAGER_REJECTED (refus proposé, à contre-signer)
        //  - porteur = RH/Admin         → REJECTED (décision finale : le RH est l'autorité)
        // AUTO_REJECTED est réservé au flux IA (saveAiScore / recomputeAiScore)
        Candidate.CandidateStatus effectiveStatus = (status == Candidate.CandidateStatus.REJECTED
                && actingManager != null)
                ? Candidate.CandidateStatus.MANAGER_REJECTED
                : status;

        Candidate.CandidateStatus previousStatus = candidate.getStatus();
        assertValidTransition(previousStatus, effectiveStatus);
        assertStatusEditableByActor(actingManager, effectiveStatus);

        String effectiveReason = reason != null ? reason.trim() : "";
        if ((effectiveStatus == Candidate.CandidateStatus.MANAGER_REJECTED
                || effectiveStatus == Candidate.CandidateStatus.REJECTED) && effectiveReason.isBlank()) {
            throw new IllegalArgumentException("Un motif est obligatoire pour un rejet manuel");
        }
        if (effectiveStatus == Candidate.CandidateStatus.AUTO_REJECTED && effectiveReason.isBlank()) {
            effectiveReason = "Rejet automatique : score IA inférieur au seuil";
        }

        // Le RH vient de statuer humainement sur une décision de l'IA : la revue
        // demandée par la zone grise ou le mode dégradé est soldée par son acte.
        if (previousStatus == Candidate.CandidateStatus.AUTO_REJECTED) {
            candidate.setNeedsHumanReview(false);
        }

        candidate.setStatus(effectiveStatus);
        if (!effectiveReason.isBlank()) {
            candidate.setStatusReason(effectiveReason);
        }
        candidate.setStatusChangedBy(currentActor());
        candidate.setStatusChangedAt(LocalDateTime.now());
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate updatedCandidate = candidateRepository.save(candidate);

        if (previousStatus != effectiveStatus) {
            auditLogService.log("CANDIDATE", updatedCandidate.getId(), "STATUS_CHANGE", previousStatus, effectiveStatus);
        }

        // Avis rendu par un manager : le RH doit le contre-signer. Il en est informé par
        // e-mail (acceptation comme refus), car il n'était destinataire d'aucune
        // notification dans le flux candidat.
        boolean awaitingHrValidation = actingManager != null && previousStatus != effectiveStatus
                && (effectiveStatus == Candidate.CandidateStatus.ACCEPTED
                    || effectiveStatus == Candidate.CandidateStatus.MANAGER_REJECTED);
        if (awaitingHrValidation) {
            List<String> hrEmails = resolveHrEmails(updatedCandidate.getJobOffer());
            if (!hrEmails.isEmpty()) {
                notificationService.sendManagerDecisionToHr(
                        updatedCandidate, effectiveStatus, actingManager, hrEmails);
            }
        }

        // Refus acté directement par le RH, sans avis manager à contre-signer (mauvais CV,
        // entretien téléphonique concluant) : c'est une décision finale, le candidat est
        // informé avec le même e-mail que le refus validé.
        // Exception : le RH CONFIRME un refus déjà prononcé par l'IA (AUTO_REJECTED →
        // REJECTED). Le candidat a déjà reçu l'e-mail de refus de l'Agent 3 ; le contreseing
        // humain est tracé dans le journal d'audit et le motif, il ne doit pas générer une
        // seconde notification du même refus.
        if (actingManager == null && previousStatus != effectiveStatus
                && effectiveStatus == Candidate.CandidateStatus.REJECTED
                && previousStatus != Candidate.CandidateStatus.AUTO_REJECTED) {
            notificationService.sendFinalRejection(updatedCandidate);
        }

        // CV validé par le RH → le CANDIDAT est informé que son profil est présélectionné
        // (Agent 2). La notification du MANAGER est déclenchée plus tard, au passage en
        // "Test technique" (après le pré-filtrage téléphonique RH), afin que le manager ne
        // soit sollicité que pour les candidats ayant franchi cette première étape.
        if (effectiveStatus == Candidate.CandidateStatus.CV_REVIEWED) {
            String offreTitre = updatedCandidate.getJobOffer() != null
                ? updatedCandidate.getJobOffer().getTitle() : "Candidature générale";
            // Simple référence pour l'e-mail du candidat : le manager n'est PAS
            // notifié ici. On n'invente aucune adresse de repli.
            ManagerRoutingService.RoutedManager reference =
                    managerRoutingService.resolve(updatedCandidate.getJobOffer()).primary();
            n8nService.triggerAgent2CvSelected(
                updatedCandidate.getId(), updatedCandidate.getEmail(),
                updatedCandidate.getFirstName(), updatedCandidate.getLastName(),
                offreTitre, reference != null ? reference.email() : null
            );
        }

        // Passage en évaluation technique → transmission du dossier complet au(x) manager(s)
        // du département (Agent 3), et confirmation au CANDIDAT que son entretien
        // téléphonique est validé et que son dossier avance à l'étape suivante.
        if (previousStatus != Candidate.CandidateStatus.TECHNICAL_TEST
                && effectiveStatus == Candidate.CandidateStatus.TECHNICAL_TEST) {
            notifyManagersForTechnicalEvaluation(updatedCandidate);
            notificationService.sendPhoneScreeningValidatedNotification(updatedCandidate);
        }

        // Agent 3 — e-mail au candidat pour les décisions qui ne passent pas par le
        // contreseing RH :
        // AUTO_REJECTED = rejeté par l'IA (le RH peut encore corriger le score)
        // WITHDRAWN     = retrait du candidat lui-même
        // Les avis du manager (ACCEPTED / MANAGER_REJECTED) ne notifient PAS le candidat :
        // il est prévenu par la validation finale du RH (voir hrFinalValidation()).
        if (effectiveStatus == Candidate.CandidateStatus.AUTO_REJECTED
                || effectiveStatus == Candidate.CandidateStatus.WITHDRAWN) {
            String offreTitre = updatedCandidate.getJobOffer() != null
                ? updatedCandidate.getJobOffer().getTitle() : "Candidature générale";
            n8nService.triggerAgent3FinalDecision(
                updatedCandidate.getId(), updatedCandidate.getEmail(),
                updatedCandidate.getFirstName(), updatedCandidate.getLastName(),
                offreTitre, effectiveStatus.name(),
                updatedCandidate.getAiSummary(), updatedCandidate.getAiRecommendation()
            );
        }

        return new CandidateResponse(updatedCandidate);
    }

    @Transactional
    public CandidateResponse withdrawApplication(Long id, String reason) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        assertCandidateOwnerOrPrivileged(candidate);
        if (candidate.getStatus() == Candidate.CandidateStatus.HIRED
                || candidate.getStatus() == Candidate.CandidateStatus.WITHDRAWN
                || candidate.getStatus() == Candidate.CandidateStatus.MANAGER_REJECTED
                || candidate.getStatus() == Candidate.CandidateStatus.AUTO_REJECTED) {
            throw new IllegalArgumentException("Cette candidature ne peut plus être retirée");
        }
        String withdrawalReason = reason == null || reason.isBlank()
                ? "Retrait demandé par le candidat" : reason.trim();
        return updateCandidateStatus(id, Candidate.CandidateStatus.WITHDRAWN, withdrawalReason);
    }

    /**
     * Vérifie que l'utilisateur authentifié a le droit d'agir sur ce candidat précis.
     *
     * - Appel anonyme (n8n) ou système : pas de restriction.
     * - RH / Admin : accès complet, quel que soit le département.
     * - Manager (sans rôle RH/Admin) : uniquement les candidats de ses propres
     *   offres (managerEmail) ou de son département. Empêche un manager
     *   d'agir sur un candidat hors périmètre via un appel API direct, même
     *   si l'interface ne le lui montre jamais.
     */
    /**
     * Transmet le dossier complet du candidat au(x) manager(s) destinataire(s) pour
     * l'évaluation technique (Agent 3 : un e-mail par manager). Déclenché au passage
     * en TECHNICAL_TEST.
     *
     * Deux garanties :
     * - la destination est résolue par la chaîne structurelle (ManagerRoutingService) ;
     *   si elle ne résout rien, la transmission est BLOQUÉE (400) et tracée, au lieu
     *   d'envoyer le dossier à une adresse de repli inventée ;
     * - la liste des destinataires est gelée sur la candidature. Le périmètre de
     *   lecture et d'écriture (ManagerScopeService) repose ensuite sur cette liste,
     *   donc changer le département de l'offre après coup ne dépossède pas le manager
     *   qui a reçu le dossier.
     */
    private void notifyManagersForTechnicalEvaluation(Candidate candidate) {
        String offreTitre = candidate.getJobOffer() != null
            ? candidate.getJobOffer().getTitle() : "Candidature générale";
        String cvUrl = candidate.getCv() != null ? candidate.getCv().getFileUrl() : null;

        ManagerRoutingService.RoutingResult routing =
                managerRoutingService.resolve(candidate.getJobOffer());
        if (!routing.isResolved()) {
            auditLogService.log("CANDIDATE", candidate.getId(), "ROUTING_FAILED",
                    candidate.getStatus().name(),
                    "Aucun manager destinataire : rattachez l'offre à un manager ou à un département contenant un manager");
            throw new IllegalArgumentException(
                    "Impossible de transmettre ce dossier : l'offre « " + offreTitre
                            + " » n'a aucun manager destinataire. Désignez le manager recruteur sur l'offre "
                            + "ou rattachez-la à un département qui compte au moins un manager.");
        }

        freezeRouting(candidate, routing);

        for (String managerEmail : routing.emails()) {
            n8nService.triggerAgent3HrValidation(
                candidate.getId(), candidate.getEmail(),
                candidate.getFirstName(), candidate.getLastName(),
                offreTitre, cvUrl, candidate.getStatus().name(), managerEmail, "RH"
            );
        }
    }

    /** Gèle la destination sur le dossier, avant l'envoi asynchrone pour que la
     *  transaction contienne la décision même si un envoi n8n échoue ensuite. */
    private void freezeRouting(Candidate candidate, ManagerRoutingService.RoutingResult routing) {
        String previous = candidate.getRoutedManagerEmails();
        candidate.setRoutedManagerEmails(String.join(",", routing.emails()));
        candidate.setRoutingBasis(routing.basis());
        candidate.setRoutedAt(LocalDateTime.now());
        ManagerRoutingService.RoutedManager primary = routing.primary();
        if (primary != null && primary.id() != null) {
            candidate.setRoutedToManager(userRepository.findById(primary.id()).orElse(null));
        } else {
            candidate.setRoutedToManager(null);
        }
        candidateRepository.save(candidate);

        // Tracée ici et pas seulement dans la liste du manager : le RH doit pouvoir
        // relire, même après coup, à qui le dossier a été transmis et sur quel critère.
        auditLogService.log("CANDIDATE", candidate.getId(), "ROUTING",
                (previous == null || previous.isBlank()) ? "NON TRANSMIS" : previous,
                routingDescription(routing));
    }

    /** « Sofen Trabelsi <sofen@…> [via le manager désigné de l'offre] », lisible dans l'audit. */
    private String routingDescription(ManagerRoutingService.RoutingResult routing) {
        String recipients = routing.managers().stream()
                .map(m -> m.fullName() + " <" + m.email() + ">")
                .collect(Collectors.joining(", "));
        return recipients + " [via " + ROUTING_BASIS_LABELS.getOrDefault(
                routing.basis(), routing.basis().name()) + "]";
    }

    /** Format lisible dans l'audit, pas l'horodatage brut de la base. */
    private static final java.time.format.DateTimeFormatter ROUTED_AT_FORMAT =
            java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final Map<RoutingBasis, String> ROUTING_BASIS_LABELS = Map.of(            RoutingBasis.OFFER_MANAGER, "le manager désigné sur l'offre",
            RoutingBasis.DEPARTMENT, "le département de l'offre",
            RoutingBasis.JOB_FAMILY, "la famille métier de l'offre",
            RoutingBasis.LEGACY_EMAIL, "l'ancien champ e-mail de l'offre",
            RoutingBasis.UNRESOLVED, "aucun critère résolu");

    /**
     * Vérifie que la transition de statut demandée respecte la machine à états du
     * cycle de vie d'une candidature (cf. chapitre conception). Empêche les sauts
     * incohérents (ex. APPLIED → HIRED) et les retours en arrière depuis un état
     * terminal. Le passage d'un statut vers lui-même est toléré (idempotence :
     * re-notification manager, ré-exécution d'un agent n8n, etc.). Les transitions
     * pilotées par l'IA (score → CV_REVIEWED / AUTO_REJECTED) passent par
     * saveAiScore/recomputeAiScore, qui délèguent à updateCandidateStatus : elles sont donc
     * soumises au même garde-fou.
     */
    private void assertValidTransition(Candidate.CandidateStatus from, Candidate.CandidateStatus to) {
        if (from == to) {
            return;
        }
        boolean allowed;
        switch (from) {
            case APPLIED:
                allowed = to == Candidate.CandidateStatus.CV_REVIEWED
                        || to == Candidate.CandidateStatus.AUTO_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case CV_REVIEWED:
                // Pas d'acceptation directe depuis CV_REVIEWED : l'entretien téléphonique RH
                // est une étape obligatoire du pipeline avant toute décision d'embauche. Un CV
                // jugé mauvais peut en revanche être refusé ou retiré sans passer par cette étape.
                allowed = to == Candidate.CandidateStatus.PHONE_SCREENING
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN
                        // Correction manuelle du score IA à la baisse (< seuil) par le RH
                        || to == Candidate.CandidateStatus.AUTO_REJECTED;
                break;
            case AUTO_REJECTED:
                // Une décision de l'IA n'est jamais définitive sans intervention humaine
                // (RGPD art. 22). Le RH dispose des deux sorties :
                //  - REJECTED    : il examine le dossier et CONFIRME le refus (motif obligatoire),
                //                  la décision devient une décision humaine tracée ;
                //  - CV_REVIEWED : il estime que l'IA a eu tort et remet le dossier dans le
                //                  pipeline. Seule la correction du score (overrideAiScore)
                //                  mène ici, car elle impose une justification et l'audite.
                // Le manager n'a aucune de ces deux sorties : assertStatusEditableByActor
                // le limite à son avis, qui serait un MANAGER_REJECTED refusé par la machine.
                allowed = to == Candidate.CandidateStatus.CV_REVIEWED
                        || to == Candidate.CandidateStatus.REJECTED;
                break;
            case PHONE_SCREENING:
                allowed = to == Candidate.CandidateStatus.TECHNICAL_TEST
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case TECHNICAL_TEST:
                allowed = to == Candidate.CandidateStatus.INTERVIEW
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case INTERVIEW:
                allowed = to == Candidate.CandidateStatus.FINAL_INTERVIEW
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case FINAL_INTERVIEW:
                allowed = to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case ACCEPTED:
                // Avis favorable du manager : le RH le contresigne (HIRED) ou le renverse
                // (REJECTED). INTERVIEW_SCHEDULED matérialise l'agenda confirmé après avis.
                allowed = to == Candidate.CandidateStatus.INTERVIEW_SCHEDULED
                        || to == Candidate.CandidateStatus.HIRED
                        || to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case MANAGER_REJECTED:
                // Refus proposé par le manager : le RH le confirme (REJECTED, e-mail au
                // candidat) ou le renverse en remettant le dossier dans le pipeline.
                allowed = to == Candidate.CandidateStatus.REJECTED
                        || to == Candidate.CandidateStatus.CV_REVIEWED
                        || to == Candidate.CandidateStatus.PHONE_SCREENING
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case INTERVIEW_SCHEDULED:
                allowed = to == Candidate.CandidateStatus.HIRED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            default:
                // REJECTED, HIRED, WITHDRAWN : états terminaux.
                // AUTO_REJECTED n'y figure plus : une rejetée IA reste rouverte au RH
                // (confirmation du refus ou correction du score), voir le cas ci-dessus.
                allowed = false;
        }
        if (!allowed) {
            throw new IllegalArgumentException(
                    "Transition de statut non autorisée : " + from + " → " + to);
        }
    }

    private void assertCandidateOwnerOrPrivileged(Candidate candidate) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new AccessDeniedException("Authentification requise");
        }
        User currentUser = userRepository.findByUsername(authentication.getName()).orElse(null);
        if (currentUser == null) {
            throw new AccessDeniedException("Utilisateur introuvable");
        }
        boolean privileged = currentUser.getRoles().stream().anyMatch(r ->
                r.getName() == Role.ERole.ROLE_HR || r.getName() == Role.ERole.ROLE_ADMIN);
        boolean owner = currentUser.getRoles().stream().anyMatch(r -> r.getName() == Role.ERole.ROLE_USER)
                && currentUser.getEmail() != null && candidate.getEmail() != null
                && currentUser.getEmail().equalsIgnoreCase(candidate.getEmail());
        if (!privileged && !owner) {
            throw new AccessDeniedException("Vous ne pouvez retirer que votre propre candidature");
        }
    }

    private String currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                ? authentication.getName() : "SYSTEM";
    }

    /** Un manager « pur » ne voit et n'instruit que les dossiers dont il est destinataire :
     *  la visibilité est exactement l'aiguillage (ManagerScopeService), ni plus large ni
     *  ailleurs. Empêche un compte manager d'agir sur un dossier hors périmètre par un appel
     *  API direct, même si l'interface ne le lui montre jamais. */
    private void assertCurrentUserCanActOn(Candidate candidate) {
        User nonPrivilegedManager = getCurrentNonPrivilegedManager();
        if (nonPrivilegedManager == null) {
            return;
        }
        if (!managerScopeService.isRecipient(candidate, nonPrivilegedManager)) {
            throw new AccessDeniedException(
                    "Vous n'êtes pas autorisé à agir sur ce candidat : il ne vous a pas été transmis");
        }
    }

    /**
     * Retourne l'utilisateur courant s'il s'agit d'un manager "pur" (rôle MANAGER sans
     * RH/Admin), c'est-à-dire un utilisateur dont la visibilité doit être restreinte à son
     * périmètre (offre/département/famille de métier). Retourne null pour tout autre cas
     * (anonyme, RH, Admin, ou utilisateur sans rôle manager) — ces appelants voient tout,
     * comme avant.
     */
    private User getCurrentNonPrivilegedManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }

        User currentUser = userRepository.findByUsername(authentication.getName()).orElse(null);
        if (currentUser == null) {
            return null;
        }

        boolean isPrivileged = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_HR || r.getName() == Role.ERole.ROLE_ADMIN);
        if (isPrivileged) {
            return null;
        }

        boolean isManager = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_MANAGER);
        return isManager ? currentUser : null;
    }

    /**
     * Restreint les statuts écrits par le point d'entrée générique de statut.
     * HIRED est une décision finale : elle ne s'écrit que par hrFinalValidation(), qui
     * exige un avis manager en attente et porte la date de présentation des documents.
     * Sans ce contrôle, la machine à états autoriserait ACCEPTED → HIRED à un manager,
     * transition que son interface ne lui propose pas.
     * Un manager « pur » ne pilote par ailleurs pas le pipeline : son périmètre est
     * l'avis (ACCEPTED / MANAGER_REJECTED).
     */
    private void assertStatusEditableByActor(User actingManager, Candidate.CandidateStatus status) {
        if (status == Candidate.CandidateStatus.HIRED) {
            throw new AccessDeniedException(
                    "L'embauche passe par la validation finale du RH, qui exige la date de présentation des documents");
        }
        if (actingManager == null) {
            return;
        }
        if (status != Candidate.CandidateStatus.ACCEPTED
                && status != Candidate.CandidateStatus.MANAGER_REJECTED) {
            throw new AccessDeniedException(
                    "Un manager ne peut enregistrer que son avis (acceptation ou refus propositionnel) ; "
                            + "le statut " + status + " relève du RH");
        }
    }

    /**
     * Destinataires RH d'une notification métier : l'auteur de l'offre s'il est compte RH,
     * à défaut l'ensemble des comptes disposant du rôle RH.
     */
    private List<String> resolveHrEmails(JobOffer jobOffer) {
        User offerAuthor = jobOffer != null ? jobOffer.getCreatedBy() : null;
        if (offerAuthor != null && offerAuthor.getEmail() != null
                && !offerAuthor.getEmail().isBlank()
                && offerAuthor.getRoles() != null
                && offerAuthor.getRoles().stream().anyMatch(r -> r.getName() == Role.ERole.ROLE_HR)) {
            return List.of(offerAuthor.getEmail());
        }
        return userRepository.findByRoleName(Role.ERole.ROLE_HR).stream()
                .map(User::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    /** Filtre une liste de candidats aux dossiers dont le manager courant est destinataire
     *  si l'appelant est un manager non privilégié ; la renvoie inchangée pour RH/Admin/
     *  système (comportement identique à avant pour ces rôles). Centralise le filtrage de
     *  lecture appliqué par toutes les méthodes de listing/recherche de candidats
     *  accessibles au rôle MANAGER. La règle est celle de ManagerScopeService : un manager
     *  voit les dossiers qu'il doit instruire, pas ceux de sa famille de métier. */
    private List<Candidate> scopeToCurrentManager(List<Candidate> candidates) {
        User nonPrivilegedManager = getCurrentNonPrivilegedManager();
        if (nonPrivilegedManager == null) {
            return candidates;
        }
        return candidates.stream()
                .filter(c -> managerScopeService.isRecipient(c, nonPrivilegedManager))
                .collect(Collectors.toList());
    }

    /**
     * Récupère les candidats par email
     */
    public List<CandidateResponse> getCandidatesByEmail(String email) {
        accessControlService.assertOwnEmailOrPrivileged(email);
        return candidateRepository.findByEmail(email).stream()
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Sauvegarde le score IA calculé par l'Agent 1 n8n
     */
    /**
     * Score IA seuil : >= 60 → CV_REVIEWED automatique (Agent 2 notifie manager)
     *                  < 60  → REJECTED automatique    (Agent 3 envoie email refus)
     *                  55-65 → zone grise : CV_REVIEWED avec needsHumanReview, jamais de rejet
     *                  automatique (cf. AiScoringService.isGreyZone)
     */
    private static final int AI_SCORE_THRESHOLD = 60;

    @Transactional
    public CandidateResponse saveAiScore(Long id, Integer score, String summary, String recommendation) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        candidate.setAiScore(score);
        if (summary != null) candidate.setAiSummary(summary);
        if (recommendation != null) candidate.setAiRecommendation(recommendation);

        // Un score transmis de l'extérieur arbitre comme un score recalculé ici : la zone
        // grise ne peut déboucher sur aucun rejet automatique, sinon ce endpoint court-circuite
        // le human-in-the-loop que recomputeAiScore impose.
        boolean greyZone = AiScoringService.isGreyZone(score);
        candidate.setNeedsHumanReview(greyZone);
        candidate.setHumanReviewReason(greyZone
                ? "Score transmis en zone grise incertaine (" + score + "/100, seuil critique = "
                        + AI_SCORE_THRESHOLD + ") : arbitrage humain recommandé."
                : null);
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        // Auto-transition basée sur le score IA
        Candidate.CandidateStatus newStatus;
        String scoreReason;
        if (greyZone) {
            newStatus = Candidate.CandidateStatus.CV_REVIEWED;
            scoreReason = "En attente de révision humaine RH : score transmis en zone grise";
        } else if (score >= AI_SCORE_THRESHOLD) {
            newStatus = Candidate.CandidateStatus.CV_REVIEWED;  // bon score → notifie manager (Agent 2)
            scoreReason = null;
        } else {
            newStatus = Candidate.CandidateStatus.AUTO_REJECTED; // score bas → rejeté par IA (Agent 3)
            scoreReason = "Rejet automatique : score IA (" + score + "/100) inférieur au seuil ("
                    + AI_SCORE_THRESHOLD + ")";
        }

        // Déléguer à updateCandidateStatus pour déclencher Agent 2 ou Agent 3
        return updateCandidateStatus(saved.getId(), newStatus, scoreReason);
    }

    /**
     * Recalcule le score IA d'un candidat en utilisant le scoring par critères
     * (technique / communication / séniorité), via Cohere si l'API répond,
     * sinon en mode simulé (fallback automatique).
     *
     * Déclenché manuellement par le RH/Admin/Manager (bouton "Recalculer avec IA").
     */
    @Transactional
    public CandidateResponse recomputeAiScore(Long id) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        AiScoringService.AiScoreResult result = aiScoringService.computeScore(candidate, candidate.getJobOffer());

        candidate.setAiScore(result.finalScore);
        candidate.setAiScoreTechnical(result.technicalScore);
        candidate.setAiScoreCommunication(result.communicationScore);
        candidate.setAiScoreSeniorityMatch(result.seniorityMatchScore);
        candidate.setAiScoreSource(result.source);
        candidate.setAiSummary(result.summary);
        candidate.setAiRecommendation(result.recommendation);
        candidate.setMatchedSkills(result.matchedSkills);
        candidate.setMissingSkills(result.missingSkills);
        candidate.setNeedsHumanReview(result.needsHumanReview);
        candidate.setHumanReviewReason(result.humanReviewReason);
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        // Remarque 2 (Human-in-the-Loop) : si le traitement nécessite un arbitrage humain
        // (erreur technique ou zone grise), on évite le rejet automatique et on transmet aux RH (CV_REVIEWED)
        Candidate.CandidateStatus newStatus;
        String statusReason = null;
        if (Boolean.TRUE.equals(result.needsHumanReview)) {
            newStatus = Candidate.CandidateStatus.CV_REVIEWED;
            statusReason = "En attente de révision humaine RH : " + result.humanReviewReason;
        } else if (result.finalScore >= AI_SCORE_THRESHOLD) {
            newStatus = Candidate.CandidateStatus.CV_REVIEWED;
        } else {
            newStatus = Candidate.CandidateStatus.AUTO_REJECTED;
            statusReason = "Rejet automatique : score IA (" + result.finalScore + "/100) inférieur au seuil (" + AI_SCORE_THRESHOLD + ")";
        }

        return updateCandidateStatus(saved.getId(), newStatus, statusReason);
    }

    /**
     * Correction manuelle du score IA par le RH (avec justification obligatoire).
     * Le score original (aiScore) est conservé pour audit ; manualScore devient
     * la référence utilisée pour la décision (CV_REVIEWED / AUTO_REJECTED).
     */
    @Transactional
    public CandidateResponse overrideAiScore(Long id, Integer manualScore, String reason, String correctedBy) {
        if (manualScore == null || manualScore < 0 || manualScore > 100) {
            throw new IllegalArgumentException("Le score manuel doit être compris entre 0 et 100");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Une justification est obligatoire pour corriger le score IA");
        }

        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        Integer previousScore = candidate.getManualScore() != null ? candidate.getManualScore() : candidate.getAiScore();

        candidate.setManualScore(manualScore);
        candidate.setManualScoreReason(reason);
        candidate.setManualScoreBy(correctedBy);
        candidate.setManualScoreDate(LocalDateTime.now());
        // L'intervention humaine est validée
        candidate.setNeedsHumanReview(false);
        candidate.setHumanReviewReason("Arbitrage humain effectué par " + correctedBy + " : " + reason);
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        auditLogService.log("CANDIDATE", saved.getId(), "SCORE_OVERRIDE",
                previousScore, manualScore + " (motif : " + reason + ")");

        Candidate.CandidateStatus newStatus = manualScore >= AI_SCORE_THRESHOLD
                ? Candidate.CandidateStatus.CV_REVIEWED
                : Candidate.CandidateStatus.AUTO_REJECTED;

        return updateCandidateStatus(saved.getId(), newStatus, "Décision RH post-arbitrage : " + reason);
    }

    /**
     * Classement des candidats d'une offre par score effectif décroissant
     * (score manuel RH si présent, sinon score IA). Utilisé pour la vue
     * "ranking" du RH/Manager.
     */
    public List<CandidateResponse> getRankingForJobOffer(Long jobOfferId) {
        return scopeToCurrentManager(candidateRepository.findByJobOfferIdWithDetails(jobOfferId)).stream()
                .sorted((a, b) -> {
                    int scoreA = a.getManualScore() != null ? a.getManualScore() : (a.getAiScore() != null ? a.getAiScore() : -1);
                    int scoreB = b.getManualScore() != null ? b.getManualScore() : (b.getAiScore() != null ? b.getAiScore() : -1);
                    return Integer.compare(scoreB, scoreA);
                })
                .map(CandidateResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Décision du manager sur un dossier déjà validé par le RH (CV_REVIEWED ou plus avancé).
     * Restreint à ACCEPTED (validation) ou REJECTED (refus → MANAGER_REJECTED).
     */
    @Transactional
    public CandidateResponse managerDecision(Long id, Candidate.CandidateStatus decision) {
        return managerDecision(id, decision, null);
    }

    @Transactional
    public CandidateResponse managerDecision(Long id, Candidate.CandidateStatus decision, String reason) {
        if (decision != Candidate.CandidateStatus.ACCEPTED && decision != Candidate.CandidateStatus.REJECTED) {
            throw new IllegalArgumentException("Décision manager invalide : doit être ACCEPTED ou REJECTED");
        }

        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        if (!candidate.isAwaitingManagerAdvice()) {
            throw new IllegalArgumentException("Le dossier doit d'abord être validé par le RH (CV_REVIEWED) avant décision manager");
        }
        if (decision == Candidate.CandidateStatus.ACCEPTED
                && candidate.getStatus() == Candidate.CandidateStatus.CV_REVIEWED) {
            throw new IllegalArgumentException(
                    "Le candidat doit d'abord passer l'entretien téléphonique RH (PHONE_SCREENING) avant d'être accepté");
        }

        return updateCandidateStatus(id, decision, reason);
    }

    /**
     * Contre-signature RH de l'avis rendu par le manager. Seule cette méthode produit les
     * deux décisions finales (HIRED / REJECTED) et donc le seul e-mail de réponse au
     * candidat ; elle exige la date de présentation des documents en cas d'embauche et un
     * motif en cas de refus.
     */
    @Transactional
    public CandidateResponse hrFinalValidation(Long id, Candidate.CandidateStatus finalDecision,
                                               LocalDateTime presentationDate, String reason) {
        if (finalDecision != Candidate.CandidateStatus.HIRED
                && finalDecision != Candidate.CandidateStatus.REJECTED) {
            throw new IllegalArgumentException("Validation finale invalide : doit être HIRED ou REJECTED");
        }

        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));
        assertCurrentUserCanActOn(candidate);
        // Contrôle redondant avec @PreAuthorize du contrôleur : la décision finale ne doit
        // jamais être écrite par un compte purement manager.
        if (getCurrentNonPrivilegedManager() != null) {
            throw new AccessDeniedException("La validation finale relève du RH");
        }

        Candidate.CandidateStatus previousStatus = candidate.getStatus();
        boolean favourableAvis = previousStatus == Candidate.CandidateStatus.ACCEPTED
                || previousStatus == Candidate.CandidateStatus.INTERVIEW_SCHEDULED;
        boolean rejectionAvis = previousStatus == Candidate.CandidateStatus.MANAGER_REJECTED;
        if (!favourableAvis && !rejectionAvis) {
            throw new IllegalArgumentException(
                    "Aucun avis de manager en attente de validation sur ce dossier (statut : " + previousStatus + ")");
        }
        if (finalDecision == Candidate.CandidateStatus.HIRED && !favourableAvis) {
            throw new IllegalArgumentException(
                    "Le manager a proposé un refus : seul le refus final peut être validé sur ce dossier");
        }
        if (finalDecision == Candidate.CandidateStatus.HIRED && presentationDate == null) {
            throw new IllegalArgumentException(
                    "La date de présentation des documents est obligatoire pour valider l'embauche");
        }

        String effectiveReason = reason != null ? reason.trim() : "";
        if (finalDecision == Candidate.CandidateStatus.REJECTED && effectiveReason.isBlank()) {
            throw new IllegalArgumentException("Un motif est obligatoire pour un refus final");
        }

        candidate.setStatus(finalDecision);
        if (!effectiveReason.isBlank()) {
            candidate.setStatusReason(effectiveReason);
        }
        if (finalDecision == Candidate.CandidateStatus.HIRED) {
            candidate.setPresentationDate(presentationDate);
        }
        candidate.setStatusChangedBy(currentActor());
        candidate.setStatusChangedAt(LocalDateTime.now());
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate validated = candidateRepository.save(candidate);
        auditLogService.log("CANDIDATE", validated.getId(), "FINAL_VALIDATION", previousStatus, finalDecision);

        if (finalDecision == Candidate.CandidateStatus.HIRED) {
            notificationService.sendHiringConvocation(validated);
        } else {
            notificationService.sendFinalRejection(validated);
        }

        return new CandidateResponse(validated);
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

