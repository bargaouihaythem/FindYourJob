package com.recrutement.app.repository;

import com.recrutement.app.entity.CV;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CVRepository extends JpaRepository<CV, Long> {

    Optional<CV> findByCandidateId(Long candidateId);

    Optional<CV> findByStoredFilename(String storedFilename);

    @Query("SELECT c FROM CV c WHERE c.candidate.jobOffer.id = :jobOfferId")
    java.util.List<CV> findByJobOfferId(@Param("jobOfferId") Long jobOfferId);

    Boolean existsByCandidateId(Long candidateId);
}

