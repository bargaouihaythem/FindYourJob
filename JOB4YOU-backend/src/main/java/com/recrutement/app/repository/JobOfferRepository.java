package com.recrutement.app.repository;

import com.recrutement.app.entity.JobOffer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface JobOfferRepository extends JpaRepository<JobOffer, Long> {

    List<JobOffer> findByStatus(JobOffer.JobStatus status);

    Page<JobOffer> findByStatus(JobOffer.JobStatus status, Pageable pageable);

    @Query("SELECT j FROM JobOffer j WHERE j.title LIKE %:keyword% OR j.description LIKE %:keyword%")
    List<JobOffer> findByTitleOrDescriptionContaining(@Param("keyword") String keyword);

    @Query("SELECT j FROM JobOffer j WHERE LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%'))")
    List<JobOffer> findByLocationContaining(@Param("location") String location);

    // Méthode pour recherche plus précise par localisation
    @Query("SELECT j FROM JobOffer j WHERE LOWER(j.location) LIKE LOWER(CONCAT(:location, '%')) OR LOWER(j.location) LIKE LOWER(CONCAT('% ', :location, '%')) OR LOWER(j.location) LIKE LOWER(CONCAT('%,', :location, '%')) OR LOWER(j.location) LIKE LOWER(CONCAT('%(', :location, '%'))")
    List<JobOffer> findByLocationContainingPrecise(@Param("location") String location);

   // List<JobOffer> findByCreatedBy(Long userId);
    @Query("SELECT j FROM JobOffer j WHERE j.createdBy.id = :userId")
    List<JobOffer> findByCreatedById(@Param("userId") Long userId);


    @Query("SELECT j FROM JobOffer j WHERE j.deadline < :currentDate AND j.status = :status")
    List<JobOffer> findExpiredOffers(@Param("currentDate") LocalDateTime currentDate, 
                                   @Param("status") JobOffer.JobStatus status);

    @Query("SELECT j FROM JobOffer j WHERE j.contractType = :contractType AND j.status = :status")
    List<JobOffer> findByContractTypeAndStatus(@Param("contractType") String contractType, 
                                             @Param("status") JobOffer.JobStatus status);

    @Query("SELECT COUNT(j) FROM JobOffer j WHERE j.createdBy.id = :userId")
    Long countByCreatedBy(@Param("userId") Long userId);

    /**
     * Compte les offres d'emploi par statut
     */
    Long countByStatus(JobOffer.JobStatus status);
}

