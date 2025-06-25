package com.recrutement.app.repository;

import com.recrutement.app.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    List<Feedback> findByCandidateId(Long candidateId);

    List<Feedback> findByAuthorId(Long authorId);

    List<Feedback> findByInterviewId(Long interviewId);

    List<Feedback> findByType(Feedback.FeedbackType type);

    List<Feedback> findByStatus(Feedback.FeedbackStatus status);

    List<Feedback> findByIsSentToCandidate(Boolean isSentToCandidate);

    @Query("SELECT f FROM Feedback f WHERE f.candidate.id = :candidateId AND f.type = :type")
    List<Feedback> findByCandidateIdAndType(@Param("candidateId") Long candidateId, 
                                          @Param("type") Feedback.FeedbackType type);

    @Query("SELECT f FROM Feedback f WHERE f.candidate.jobOffer.id = :jobOfferId")
    List<Feedback> findByJobOfferId(@Param("jobOfferId") Long jobOfferId);

    @Query("SELECT COUNT(f) FROM Feedback f WHERE f.author.id = :authorId")
    Long countByAuthorId(@Param("authorId") Long authorId);

    @Query("SELECT COUNT(f) FROM Feedback f WHERE f.candidate.id = :candidateId AND f.isSentToCandidate = true")
    Long countSentFeedbacksByCandidateId(@Param("candidateId") Long candidateId);

    /**
     * Compte les feedbacks par statut
     */
    Long countByStatus(Feedback.FeedbackStatus status);
}

