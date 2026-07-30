package com.recrutement.app.repository;

import com.recrutement.app.entity.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    List<Reminder> findBySentFalseAndReminderDateLessThanEqual(LocalDateTime now);

    List<Reminder> findByReminderDateBetweenOrderByReminderDateAsc(LocalDateTime start, LocalDateTime end);

    List<Reminder> findAllByOrderByReminderDateDesc();

    List<Reminder> findByRelatedTypeAndRelatedIdAndSentFalse(Reminder.RelatedType relatedType, Long relatedId);
}
