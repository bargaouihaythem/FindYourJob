package com.recrutement.app.repository;

import com.recrutement.app.entity.GoldSetCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GoldSetCaseRepository extends JpaRepository<GoldSetCase, Long> {

    Optional<GoldSetCase> findByCaseRef(String caseRef);

    @Query("select c from GoldSetCase c join fetch c.jobOffer order by c.caseRef")
    List<GoldSetCase> findAllWithOffer();
}
