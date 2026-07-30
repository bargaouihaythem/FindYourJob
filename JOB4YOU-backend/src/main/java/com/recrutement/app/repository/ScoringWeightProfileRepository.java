package com.recrutement.app.repository;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ScoringWeightProfileRepository extends JpaRepository<ScoringWeightProfile, Long> {

    Optional<ScoringWeightProfile> findByJobFamilyAndSeniorityLevel(
            JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel seniorityLevel);
}
