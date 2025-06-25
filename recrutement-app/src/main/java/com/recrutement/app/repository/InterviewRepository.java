package com.recrutement.app.repository;

import com.recrutement.app.entity.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InterviewRepository extends JpaRepository<Interview, Long> {

    List<Interview> findByCandidateId(Long candidateId);

    List<Interview> findByInterviewerId(Long interviewerId);

    List<Interview> findByStatus(Interview.InterviewStatus status);

    List<Interview> findByType(Interview.InterviewType type);

    @Query("SELECT i FROM Interview i WHERE i.interviewDate BETWEEN :startDate AND :endDate")
    List<Interview> findByInterviewDateBetween(@Param("startDate") LocalDateTime startDate, 
                                             @Param("endDate") LocalDateTime endDate);

    @Query("SELECT i FROM Interview i WHERE i.interviewer.id = :interviewerId AND i.interviewDate BETWEEN :startDate AND :endDate")
    List<Interview> findByInterviewerIdAndInterviewDateBetween(@Param("interviewerId") Long interviewerId, 
                                                             @Param("startDate") LocalDateTime startDate, 
                                                             @Param("endDate") LocalDateTime endDate);

    @Query("SELECT i FROM Interview i WHERE i.candidate.jobOffer.id = :jobOfferId")
    List<Interview> findByJobOfferId(@Param("jobOfferId") Long jobOfferId);

    @Query("SELECT COUNT(i) FROM Interview i WHERE i.interviewer.id = :interviewerId AND i.status = :status")
    Long countByInterviewerIdAndStatus(@Param("interviewerId") Long interviewerId, 
                                     @Param("status") Interview.InterviewStatus status);

    @Query("SELECT i FROM Interview i " +
           "LEFT JOIN FETCH i.candidate c " +
           "LEFT JOIN FETCH c.jobOffer jo " +
           "LEFT JOIN FETCH i.interviewer")
    List<Interview> findAllWithRelations();
    
    @Query("SELECT i FROM Interview i " +
           "LEFT JOIN FETCH i.candidate c " +
           "LEFT JOIN FETCH c.jobOffer jo " +
           "LEFT JOIN FETCH i.interviewer " +
           "WHERE i.status = :status")
    List<Interview> findByStatusWithRelations(@Param("status") Interview.InterviewStatus status);

    @Query("SELECT i FROM Interview i " +
           "LEFT JOIN FETCH i.candidate c " +
           "LEFT JOIN FETCH c.jobOffer jo " +
           "LEFT JOIN FETCH i.interviewer " +
           "WHERE c.email = :email")
    List<Interview> findByCandidateEmail(@Param("email") String email);
}

