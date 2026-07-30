package com.recrutement.app.repository;

import com.recrutement.app.entity.AuditLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByEntityTypeAndEntityIdOrderByPerformedAtDesc(String entityType, Long entityId);

    @Query("SELECT a FROM AuditLog a ORDER BY a.performedAt DESC")
    List<AuditLog> findRecent(Pageable pageable);
}
