package com.recrutement.app.repository;

import com.recrutement.app.entity.InternalNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InternalNoteRepository extends JpaRepository<InternalNote, Long> {

    List<InternalNote> findByCandidateIdOrderByPinnedDescCreatedAtDesc(Long candidateId);
}
