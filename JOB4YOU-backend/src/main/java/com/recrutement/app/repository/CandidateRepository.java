package com.recrutement.app.repository;

import com.recrutement.app.entity.Candidate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Long> {

    List<Candidate> findByJobOfferId(Long jobOfferId);

    Page<Candidate> findByJobOfferId(Long jobOfferId, Pageable pageable);
    
    // Requêtes optimisées avec JOIN FETCH pour éviter le problème N+1
    @Query("SELECT c FROM Candidate c LEFT JOIN FETCH c.cv LEFT JOIN FETCH c.jobOffer WHERE c.jobOffer.id = :jobOfferId")
    List<Candidate> findByJobOfferIdWithDetails(@Param("jobOfferId") Long jobOfferId);
    
    @Query("SELECT c FROM Candidate c LEFT JOIN FETCH c.cv LEFT JOIN FETCH c.jobOffer")
    List<Candidate> findAllWithDetails();

    List<Candidate> findByStatus(Candidate.CandidateStatus status);

    Optional<Candidate> findByEmailAndJobOfferId(String email, Long jobOfferId);

    @Query("SELECT c FROM Candidate c WHERE c.firstName LIKE %:name% OR c.lastName LIKE %:name%")
    List<Candidate> findByFirstNameOrLastNameContaining(@Param("name") String name);

    @Query("SELECT c FROM Candidate c WHERE c.jobOffer.id = :jobOfferId AND c.status = :status")
    List<Candidate> findByJobOfferIdAndStatus(@Param("jobOfferId") Long jobOfferId, 
                                            @Param("status") Candidate.CandidateStatus status);

    @Query("SELECT c FROM Candidate c WHERE c.applicationDate BETWEEN :startDate AND :endDate")
    List<Candidate> findByApplicationDateBetween(@Param("startDate") LocalDateTime startDate, 
                                               @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COUNT(c) FROM Candidate c WHERE c.jobOffer.id = :jobOfferId")
    Long countByJobOfferId(@Param("jobOfferId") Long jobOfferId);

    @Query("SELECT COUNT(c) FROM Candidate c WHERE c.status = :status")
    Long countByStatus(@Param("status") Candidate.CandidateStatus status);

    Boolean existsByEmailAndJobOfferId(String email, Long jobOfferId);

    @Query("SELECT c FROM Candidate c LEFT JOIN FETCH c.cv")
    List<Candidate> findAllWithCV();

    @Query(value = "SELECT c FROM Candidate c LEFT JOIN FETCH c.cv",
           countQuery = "SELECT count(c) FROM Candidate c")
    List<Candidate> findAllWithCV(Pageable pageable);

    List<Candidate> findByEmail(String email);

    /**
     * Retourne les candidats dont le statut fait partie de la liste.
     * Utilisé par la vue Manager (dossiers validés par RH uniquement).
     */
    @Query("SELECT c FROM Candidate c LEFT JOIN FETCH c.cv LEFT JOIN FETCH c.jobOffer WHERE c.status IN :statuses")
    List<Candidate> findByStatusIn(@Param("statuses") List<Candidate.CandidateStatus> statuses);

    /**
     * Vue Manager scopée : dossiers validés (statuts fournis) dont l'offre est
     * rattachée au manager connecté, soit directement (managerEmail), soit via
     * son département (department.id). Utilisé pour éviter qu'un manager voie
     * les candidatures d'un autre département.
     */
    @Query("SELECT c FROM Candidate c LEFT JOIN FETCH c.cv LEFT JOIN FETCH c.jobOffer jo " +
           "WHERE c.status IN :statuses " +
           "AND (jo.managerEmail = :managerEmail " +
           "     OR (:departmentId IS NOT NULL AND jo.department.id = :departmentId))")
    List<Candidate> findByStatusInAndJobOfferManagerEmailOrDepartment(
            @Param("statuses") List<Candidate.CandidateStatus> statuses,
            @Param("managerEmail") String managerEmail,
            @Param("departmentId") Long departmentId);
}

