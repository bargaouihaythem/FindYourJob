package com.recrutement.app.service;

import com.recrutement.app.dto.ApplicationRequest;
import com.recrutement.app.dto.CandidateRequest;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.CV;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.JobOffer;
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
    private AuditLogService auditLogService;

    @Autowired
    private AccessControlService accessControlService;

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

        // Envoyer un e-mail de confirmation au candidat (via Spring Mail)
        notificationService.sendApplicationConfirmation(savedCandidate);

        // Déclencher l'Agent 1 n8n (CV Parser + scoring IA) en arrière-plan
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
     * Scope : un utilisateur avec UNIQUEMENT le rôle MANAGER ne voit que les
     * candidatures des offres dont il est le manager (managerEmail) ou de son
     * département. RH/Admin (même s'ils cumulent le rôle MANAGER) voient tout.
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
            // MANAGER seul : scope à ses offres (email), son département, ou sa famille de métier assignée
            Long departmentId = currentUser.getDepartment() != null ? currentUser.getDepartment().getId() : null;
            candidates = candidateRepository.findByStatusInAndJobOfferManagerEmailOrDepartment(
                    validatedStatuses, currentUser.getEmail(), departmentId, currentUser.getJobFamily());
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
    @Transactional
    public CandidateResponse updateCandidateStatus(Long id, Candidate.CandidateStatus status) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        assertCurrentUserCanActOn(candidate);

        // REJECTED générique envoyé par le frontend → MANAGER_REJECTED (décision humaine)
        // AUTO_REJECTED est réservé au flux IA via saveAiScore()
        Candidate.CandidateStatus effectiveStatus = (status == Candidate.CandidateStatus.REJECTED)
                ? Candidate.CandidateStatus.MANAGER_REJECTED
                : status;

        Candidate.CandidateStatus previousStatus = candidate.getStatus();
        assertValidTransition(previousStatus, effectiveStatus);
        candidate.setStatus(effectiveStatus);
        candidate.setLastUpdated(LocalDateTime.now());

        Candidate updatedCandidate = candidateRepository.save(candidate);

        if (previousStatus != effectiveStatus) {
            auditLogService.log("CANDIDATE", updatedCandidate.getId(), "STATUS_CHANGE", previousStatus, effectiveStatus);
        }

        // CV validé par le RH → le CANDIDAT est informé que son profil est présélectionné
        // (Agent 2). La notification du MANAGER est désormais déclenchée plus tard, au
        // passage en "Test technique" (après le pré-filtrage téléphonique RH), afin que le
        // manager ne soit sollicité que pour les candidats ayant franchi cette première étape.
        if (effectiveStatus == Candidate.CandidateStatus.CV_REVIEWED) {
            String offreTitre = updatedCandidate.getJobOffer() != null
                ? updatedCandidate.getJobOffer().getTitle() : "Candidature générale";
            List<String> resolvedManagerEmails = managerRoutingService.resolveManagerEmails(updatedCandidate.getJobOffer());
            String refManagerEmail = !resolvedManagerEmails.isEmpty()
                ? resolvedManagerEmails.get(0) : "bargaouihaythem1@gmail.com";
            n8nService.triggerAgent2CvSelected(
                updatedCandidate.getId(), updatedCandidate.getEmail(),
                updatedCandidate.getFirstName(), updatedCandidate.getLastName(),
                offreTitre, refManagerEmail
            );
        }

        // Passage en évaluation technique → transmission du dossier complet au(x) manager(s)
        // du département (Agent 3). C'est le moment où le manager prend le relais.
        if (previousStatus != Candidate.CandidateStatus.TECHNICAL_TEST
                && effectiveStatus == Candidate.CandidateStatus.TECHNICAL_TEST) {
            notifyManagersForTechnicalEvaluation(updatedCandidate);
        }

        // Agent 3 — Décision finale → email au candidat
        // AUTO_REJECTED    = rejeté par l'IA (score < seuil)
        // MANAGER_REJECTED = rejeté manuellement par le manager/RH
        // ACCEPTED         = accepté (pré-embauche)
        // HIRED            = embauché (confirmation finale post-entretien)
        if (effectiveStatus == Candidate.CandidateStatus.ACCEPTED
                || effectiveStatus == Candidate.CandidateStatus.AUTO_REJECTED
                || effectiveStatus == Candidate.CandidateStatus.MANAGER_REJECTED
                || effectiveStatus == Candidate.CandidateStatus.HIRED) {
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
     * Transmet le dossier complet du candidat au(x) manager(s) de son département pour
     * l'évaluation technique (Agent 3 : un e-mail par manager destinataire). Déclenché au
     * passage en TECHNICAL_TEST, que la transition provienne de la fiche candidat ou de la
     * planification d'un entretien technique — d'où sa visibilité publique.
     */
    public void notifyManagersForTechnicalEvaluation(Candidate candidate) {
        String offreTitre = candidate.getJobOffer() != null
            ? candidate.getJobOffer().getTitle() : "Candidature générale";
        String cvUrl = candidate.getCv() != null ? candidate.getCv().getFileUrl() : null;
        List<String> resolved = managerRoutingService.resolveManagerEmails(candidate.getJobOffer());
        List<String> managerEmails = !resolved.isEmpty()
            ? resolved : List.of("bargaouihaythem1@gmail.com");
        for (String managerEmail : managerEmails) {
            n8nService.triggerAgent3HrValidation(
                candidate.getId(), candidate.getEmail(),
                candidate.getFirstName(), candidate.getLastName(),
                offreTitre, cvUrl, candidate.getStatus().name(), managerEmail, "RH"
            );
        }
    }

    /**
     * Vérifie que la transition de statut demandée respecte la machine à états du
     * cycle de vie d'une candidature (cf. chapitre conception). Empêche les sauts
     * incohérents (ex. APPLIED → HIRED) et les retours en arrière depuis un état
     * terminal. Le passage d'un statut vers lui-même est toléré (idempotence :
     * re-notification manager, ré-exécution d'un agent n8n, etc.). Les transitions
     * pilotées par l'IA (score → CV_REVIEWED / AUTO_REJECTED) passent par un autre
     * chemin (saveAiScore) et ne sont pas concernées.
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
                allowed = to == Candidate.CandidateStatus.PHONE_SCREENING
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN
                        // Correction manuelle du score IA à la baisse (< seuil) par le RH
                        || to == Candidate.CandidateStatus.AUTO_REJECTED;
                break;
            case AUTO_REJECTED:
                // Seule sortie autorisée depuis un rejet IA : la correction manuelle du
                // score par le RH/Admin (override), qui repasse le dossier en CV_REVIEWED.
                allowed = to == Candidate.CandidateStatus.CV_REVIEWED;
                break;
            case PHONE_SCREENING:
                allowed = to == Candidate.CandidateStatus.TECHNICAL_TEST
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case TECHNICAL_TEST:
                allowed = to == Candidate.CandidateStatus.INTERVIEW
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case INTERVIEW:
                allowed = to == Candidate.CandidateStatus.FINAL_INTERVIEW
                        || to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case FINAL_INTERVIEW:
                allowed = to == Candidate.CandidateStatus.ACCEPTED
                        || to == Candidate.CandidateStatus.MANAGER_REJECTED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case ACCEPTED:
                allowed = to == Candidate.CandidateStatus.INTERVIEW_SCHEDULED
                        || to == Candidate.CandidateStatus.HIRED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            case INTERVIEW_SCHEDULED:
                allowed = to == Candidate.CandidateStatus.HIRED
                        || to == Candidate.CandidateStatus.WITHDRAWN;
                break;
            default:
                // AUTO_REJECTED, MANAGER_REJECTED, REJECTED (hérité), HIRED, WITHDRAWN : états terminaux
                allowed = false;
        }
        if (!allowed) {
            throw new IllegalArgumentException(
                    "Transition de statut non autorisée : " + from + " → " + to);
        }
    }

    private void assertCurrentUserCanActOn(Candidate candidate) {
        User nonPrivilegedManager = getCurrentNonPrivilegedManager();
        if (nonPrivilegedManager == null) {
            return;
        }
        if (!isInManagerScope(candidate.getJobOffer(), nonPrivilegedManager)) {
            throw new AccessDeniedException(
                    "Vous n'êtes pas autorisé à agir sur ce candidat : il ne fait pas partie de votre périmètre (offre/département)");
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

    /** Un candidat est dans le périmètre d'un manager si son offre lui est directement rattachée
     *  (managerEmail), ou partage son département, ou partage sa famille de métier. */
    private boolean isInManagerScope(JobOffer jobOffer, User manager) {
        boolean ownsByEmail = jobOffer != null && jobOffer.getManagerEmail() != null
                && jobOffer.getManagerEmail().equalsIgnoreCase(manager.getEmail());
        boolean ownsByDepartment = jobOffer != null && jobOffer.getDepartment() != null
                && manager.getDepartment() != null
                && jobOffer.getDepartment().getId().equals(manager.getDepartment().getId());
        boolean ownsByJobFamily = jobOffer != null && jobOffer.getJobFamily() != null
                && manager.getJobFamily() != null
                && jobOffer.getJobFamily() == manager.getJobFamily();
        return ownsByEmail || ownsByDepartment || ownsByJobFamily;
    }

    /** Filtre une liste de candidats au périmètre du manager courant si l'appelant est un
     *  manager non privilégié ; la renvoie inchangée pour RH/Admin/système (comportement
     *  identique à avant pour ces rôles). Centralise le filtrage de lecture appliqué par
     *  toutes les méthodes de listing/recherche de candidats accessibles au rôle MANAGER. */
    private List<Candidate> scopeToCurrentManager(List<Candidate> candidates) {
        User nonPrivilegedManager = getCurrentNonPrivilegedManager();
        if (nonPrivilegedManager == null) {
            return candidates;
        }
        return candidates.stream()
                .filter(c -> isInManagerScope(c.getJobOffer(), nonPrivilegedManager))
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
     */
    private static final int AI_SCORE_THRESHOLD = 60;

    @Transactional
    public CandidateResponse saveAiScore(Long id, Integer score, String summary, String recommendation) {
        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        candidate.setAiScore(score);
        if (summary != null) candidate.setAiSummary(summary);
        if (recommendation != null) candidate.setAiRecommendation(recommendation);
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        // Auto-transition basée sur le score IA
        Candidate.CandidateStatus newStatus = score >= AI_SCORE_THRESHOLD
                ? Candidate.CandidateStatus.CV_REVIEWED     // bon score → notifie manager (Agent 2)
                : Candidate.CandidateStatus.AUTO_REJECTED;  // score bas → rejeté par IA (Agent 3)

        // Déléguer à updateCandidateStatus pour déclencher Agent 2 ou Agent 3
        return updateCandidateStatus(saved.getId(), newStatus);
    }

    /**
     * Recalcule le score IA d'un candidat en utilisant le scoring par critères
     * (technique / communication / séniorité), via HuggingFace si configuré,
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
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        Candidate.CandidateStatus newStatus = result.finalScore >= AI_SCORE_THRESHOLD
                ? Candidate.CandidateStatus.CV_REVIEWED
                : Candidate.CandidateStatus.AUTO_REJECTED;

        return updateCandidateStatus(saved.getId(), newStatus);
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
        candidate.setLastUpdated(LocalDateTime.now());
        Candidate saved = candidateRepository.save(candidate);

        auditLogService.log("CANDIDATE", saved.getId(), "SCORE_OVERRIDE",
                previousScore, manualScore + " (motif : " + reason + ")");

        Candidate.CandidateStatus newStatus = manualScore >= AI_SCORE_THRESHOLD
                ? Candidate.CandidateStatus.CV_REVIEWED
                : Candidate.CandidateStatus.AUTO_REJECTED;

        return updateCandidateStatus(saved.getId(), newStatus);
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
        if (decision != Candidate.CandidateStatus.ACCEPTED && decision != Candidate.CandidateStatus.REJECTED) {
            throw new IllegalArgumentException("Décision manager invalide : doit être ACCEPTED ou REJECTED");
        }

        Candidate candidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Candidat non trouvé avec l'ID: " + id));

        List<Candidate.CandidateStatus> reviewable = List.of(
                Candidate.CandidateStatus.CV_REVIEWED,
                Candidate.CandidateStatus.PHONE_SCREENING,
                Candidate.CandidateStatus.TECHNICAL_TEST,
                Candidate.CandidateStatus.INTERVIEW,
                Candidate.CandidateStatus.FINAL_INTERVIEW
        );
        if (!reviewable.contains(candidate.getStatus())) {
            throw new IllegalArgumentException("Le dossier doit d'abord être validé par le RH (CV_REVIEWED) avant décision manager");
        }

        return updateCandidateStatus(id, decision);
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

