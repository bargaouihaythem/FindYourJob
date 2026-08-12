package com.recrutement.app.repository;

import com.recrutement.app.entity.N8nOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface N8nOutboxEventRepository extends JpaRepository<N8nOutboxEvent, Long> {

    Optional<N8nOutboxEvent> findByEventKey(String eventKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM N8nOutboxEvent e WHERE e.status = 'PENDING' AND e.nextAttemptAt <= :now ORDER BY e.createdAt ASC")
    List<N8nOutboxEvent> findPendingForUpdate(@Param("now") LocalDateTime now,
                                               org.springframework.data.domain.Pageable pageable);
}
