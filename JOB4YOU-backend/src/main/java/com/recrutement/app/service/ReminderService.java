package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.Reminder;
import com.recrutement.app.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Planifie et envoie les rappels d'entretien (email candidat J-1, email
 * interviewer H-2). Le contenu HTML est pré-rendu via Thymeleaf au moment de
 * la création du rappel et stocké tel quel : l'envoi différé (scheduler) n'a
 * donc besoin d'aucune donnée métier supplémentaire, juste du texte à poster.
 */
@Service
public class ReminderService {

    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private TemplateEngine templateEngine;

    @Autowired
    private EmailService emailService;

    @Transactional
    public void createInterviewReminders(Interview interview) {
        Candidate candidate = interview.getCandidate();
        JobOffer jobOffer = candidate.getJobOffer();
        String jobOfferTitle = jobOffer != null ? jobOffer.getTitle() : "Entretien général";
        LocalDateTime interviewDate = interview.getInterviewDate();
        if (interviewDate == null) return;

        // Rappel candidat : 1 jour avant, à 9h
        LocalDateTime candidateReminderDate = interviewDate.minusDays(1).with(LocalTime.of(9, 0));
        if (candidateReminderDate.isAfter(LocalDateTime.now())) {
            Map<String, Object> candidateVars = new HashMap<>();
            candidateVars.put("candidateName", candidate.getFirstName() + " " + candidate.getLastName());
            candidateVars.put("jobOfferTitle", jobOfferTitle);
            candidateVars.put("interviewDate", interviewDate);
            candidateVars.put("location", interview.getLocation() != null ? interview.getLocation() : "À confirmer");

            createReminder(
                    "Rappel entretien (candidat) — " + candidate.getEmail(),
                    render("emails/reminder-candidate", candidateVars),
                    candidateReminderDate,
                    Reminder.RelatedType.INTERVIEW,
                    interview.getId(),
                    candidate.getEmail()
            );
        }

        // Rappel interviewer : 2 heures avant
        LocalDateTime interviewerReminderDate = interviewDate.minusHours(2);
        if (interviewerReminderDate.isAfter(LocalDateTime.now()) && interview.getInterviewer() != null) {
            Map<String, Object> interviewerVars = new HashMap<>();
            interviewerVars.put("interviewerName", interview.getInterviewer().getUsername());
            interviewerVars.put("candidateName", candidate.getFirstName() + " " + candidate.getLastName());
            interviewerVars.put("jobOfferTitle", jobOfferTitle);
            interviewerVars.put("interviewDate", interviewDate);
            interviewerVars.put("location", interview.getLocation() != null ? interview.getLocation() : "À confirmer");

            createReminder(
                    "Rappel entretien (interviewer) — " + interview.getInterviewer().getUsername(),
                    render("emails/reminder-interviewer", interviewerVars),
                    interviewerReminderDate,
                    Reminder.RelatedType.INTERVIEW,
                    interview.getId(),
                    interview.getInterviewer().getEmail()
            );
        }
    }

    private void createReminder(String title, String message, LocalDateTime reminderDate,
                                 Reminder.RelatedType relatedType, Long relatedId, String recipientEmail) {
        Reminder reminder = new Reminder();
        reminder.setTitle(title);
        reminder.setMessage(message);
        reminder.setReminderDate(reminderDate);
        reminder.setRelatedType(relatedType);
        reminder.setRelatedId(relatedId);
        reminder.setRecipientEmail(recipientEmail);
        reminderRepository.save(reminder);
    }

    private String render(String template, Map<String, Object> variables) {
        Context context = new Context();
        variables.forEach(context::setVariable);
        return templateEngine.process(template, context);
    }

    /**
     * Appelé toutes les heures par le scheduler : envoie tous les rappels
     * dont la date est passée et qui n'ont pas encore été envoyés.
     */
    @Transactional
    public void dispatchDueReminders() {
        List<Reminder> due = reminderRepository.findBySentFalseAndReminderDateLessThanEqual(LocalDateTime.now());
        for (Reminder reminder : due) {
            try {
                emailService.sendHtmlEmail(reminder.getRecipientEmail(), reminder.getTitle(), reminder.getMessage());
                reminder.setSent(true);
                reminder.setSentAt(LocalDateTime.now());
                reminderRepository.save(reminder);
            } catch (Exception e) {
                log.error("[ReminderService] Échec d'envoi du rappel #{} à {} : {}",
                        reminder.getId(), reminder.getRecipientEmail(), e.getMessage());
            }
        }
    }

    /**
     * Annule les rappels pas encore envoyés d'un entretien (utilisé quand
     * l'entretien est annulé/reprogrammé, pour éviter un rappel obsolète).
     */
    @Transactional
    public void cancelInterviewReminders(Long interviewId) {
        List<Reminder> pending = reminderRepository.findByRelatedTypeAndRelatedIdAndSentFalse(
                Reminder.RelatedType.INTERVIEW, interviewId);
        reminderRepository.deleteAll(pending);
    }

    public List<Reminder> getAll() {
        return reminderRepository.findAllByOrderByReminderDateDesc();
    }

    public List<Reminder> getTodayReminders() {
        LocalDateTime startOfDay = LocalDateTime.now().with(LocalTime.MIN);
        LocalDateTime endOfDay = LocalDateTime.now().with(LocalTime.MAX);
        return reminderRepository.findByReminderDateBetweenOrderByReminderDateAsc(startOfDay, endOfDay);
    }
}
