package com.recrutement.app.service;

import com.recrutement.app.dto.JobOfferRequest;
import com.recrutement.app.dto.JobOfferResponse;
import com.recrutement.app.dto.ManagerOptionResponse;
import com.recrutement.app.entity.Department;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Role;
import com.recrutement.app.entity.User;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.DepartmentRepository;
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

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ManagerRoutingService managerRoutingService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private DepartmentProposalService departmentProposalService;

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
        auditManagerDepartmentOverride(savedJobOffer);
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
        auditManagerDepartmentOverride(updatedJobOffer);
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
        // Utiliser la recherche précise pour éviter trop de résultats
        List<JobOffer> results = jobOfferRepository.findByLocationContainingPrecise(location.trim());
        
        // Si aucun résultat avec la recherche précise, fallback vers la recherche normale
        if (results.isEmpty()) {
            results = jobOfferRepository.findByLocationContaining(location.trim());
        }
        
        return results.stream()
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
     * Bascule automatiquement en EXPIRED les offres ACTIVE dont la deadline est dépassée.
     * Sans cette synchronisation, une offre reste visible sur GET /api/job-offers/public
     * (filtré sur status=ACTIVE) après sa date limite tant qu'un RH ne clique pas
     * manuellement "Expirée" dans le dropdown de statut.
     *
     * @return le nombre d'offres basculées
     */
    @Transactional
    public int expireOverdueJobOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<JobOffer> overdue = jobOfferRepository.findExpiredOffers(now, JobOffer.JobStatus.ACTIVE);
        for (JobOffer jobOffer : overdue) {
            jobOffer.setStatus(JobOffer.JobStatus.EXPIRED);
            jobOffer.setUpdatedAt(now);
        }
        jobOfferRepository.saveAll(overdue);
        return overdue.size();
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
        jobOffer.setJobFamily(request.getJobFamily());
        jobOffer.setSeniorityLevel(request.getSeniorityLevel());
        jobOffer.setContractType(request.getContractType());
        jobOffer.setLocation(request.getLocation());
        jobOffer.setSalaryRange(request.getSalaryRange());
        jobOffer.setDeadline(request.getDeadline());
        jobOffer.setManagerEmail(request.getManagerEmail());

        if (request.getDepartmentId() != null) {
            Department department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Département non trouvé avec l'ID: " + request.getDepartmentId()));
            jobOffer.setDepartment(department);
        } else {
            jobOffer.setDepartment(null);
        }

        if (request.getStatus() != null) {
            jobOffer.setStatus(request.getStatus());
        } else if (jobOffer.getStatus() == null) {
            jobOffer.setStatus(JobOffer.JobStatus.ACTIVE);
        }

        applyHiringManager(request, jobOffer);
    }

    /**
     * Le manager recruteur est une décision du RH, pas une déduction. On vérifie que le
     * compte existe et porte le rôle MANAGER : sinon l'aiguillage passerait silencieusement
     * au niveau suivant et le dossier partirait ailleurs que voulu. Un manager hors du
     * département de l'offre n'est admis que si le RH l'assume explicitement
     * (allowManagerDepartmentMismatch), et le choix est alors tracé dans le journal d'audit.
     */
    private void applyHiringManager(JobOfferRequest request, JobOffer jobOffer) {
        if (request.getHiringManagerId() == null) {
            jobOffer.setHiringManager(null);
            return;
        }
        User manager = userRepository.findById(request.getHiringManagerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Manager recruteur non trouvé avec l'ID: " + request.getHiringManagerId()));
        boolean isManager = manager.getRoles() != null && manager.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.ERole.ROLE_MANAGER);
        if (!isManager) {
            throw new IllegalArgumentException(
                    "Le manager recruteur désigné doit disposer du rôle MANAGER");
        }
        boolean bothDepartments = jobOffer.getDepartment() != null && manager.getDepartment() != null;
        boolean sameDepartment = bothDepartments
                && jobOffer.getDepartment().getId().equals(manager.getDepartment().getId());
        if (bothDepartments && !sameDepartment
                && !Boolean.TRUE.equals(request.getAllowManagerDepartmentMismatch())) {
            throw new IllegalArgumentException("Le manager recruteur « " + manager.getUsername()
                    + " » n'appartient pas au département de l'offre ("
                    + jobOffer.getDepartment().getName()
                    + "). Validez explicitement le dépassement pour outrepasser ce contrôle.");
        }
        jobOffer.setHiringManager(manager);
    }

    /** Trace un manager recruteur sciemment placé hors du département de l'offre. */
    private void auditManagerDepartmentOverride(JobOffer jobOffer) {
        User manager = jobOffer.getHiringManager();
        if (manager == null || jobOffer.getDepartment() == null || manager.getDepartment() == null) {
            return;
        }
        if (jobOffer.getDepartment().getId().equals(manager.getDepartment().getId())) {
            return;
        }
        auditLogService.log("JOB_OFFER", jobOffer.getId(), "MANAGER_DEPARTMENT_OVERRIDE",
                jobOffer.getDepartment().getName(), manager.getEmail());
    }

    /**
     * Où partiraient les dossiers de cette offre si le RH les transmettait maintenant :
     * destinataires résolus et niveau de la chaîne qui les a trouvés. Affiché au RH avant
     * qu'il ne confirme une transmission, jamais piloté par le score IA.
     */
    public ManagerRoutingService.RoutingResult routingPreview(Long jobOfferId) {
        JobOffer jobOffer = jobOfferRepository.findById(jobOfferId)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + jobOfferId));
        return managerRoutingService.resolve(jobOffer);
    }

    /**
     * Managers désignables comme recruteurs dans le formulaire d'offre : tous les comptes
     * MANAGER, ceux du département choisi en tête de liste. Le RH garde la main — la liste
     * est une aide, jamais un choix automatique.
     */
    public List<ManagerOptionResponse> getAssignableManagers(Long departmentId) {
        List<ManagerOptionResponse> all = userRepository.findByRoleName(Role.ERole.ROLE_MANAGER).stream()
                .filter(manager -> manager.getEmail() != null && !manager.getEmail().isBlank())
                .map(ManagerOptionResponse::new)
                .collect(Collectors.toList());
        if (departmentId == null) {
            return all;
        }
        List<ManagerOptionResponse> ordered = all.stream()
                .filter(manager -> departmentId.equals(manager.getDepartmentId()))
                .collect(Collectors.toList());
        all.stream()
                .filter(manager -> !departmentId.equals(manager.getDepartmentId()))
                .forEach(ordered::add);
        return ordered;
    }

    /**
     * Départements proposés pour une offre qui n'en a pas encore, à partir de son intitulé
     * et de ses compétences. Le RH confirme : aucune de ces propositions ne s'applique seule.
     */
    public List<DepartmentProposalService.Proposal> suggestDepartments(Long jobOfferId) {
        JobOffer jobOffer = jobOfferRepository.findById(jobOfferId)
                .orElseThrow(() -> new ResourceNotFoundException("Job offer not found with id: " + jobOfferId));
        return departmentProposalService.propose(jobOffer.getTitle(), jobOffer.getRequiredSkills());
    }
}

