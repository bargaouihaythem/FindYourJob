package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.entity.Reminder;
import com.recrutement.app.entity.User;
import com.recrutement.app.repository.InterviewRepository;
import com.recrutement.app.repository.ReminderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.thymeleaf.TemplateEngine;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link ReminderService}.
 *
 * Un rappel est pré-rendu puis stocké : il part donc une heure, un jour, parfois une
 * semaine après le geste qui l'a créé. Ce qui est verrouillé ici, c'est qu'il ne parte
 * que s'il annonce encore un entretien à tenir — et une seule fois.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ReminderService - Tests unitaires")
class ReminderServiceTest {

    @Mock ReminderRepository reminderRepository;
    @Mock InterviewRepository interviewRepository;
    @Mock EmailService emailService;
    @Mock TemplateEngine templateEngine;

    @InjectMocks
    ReminderService reminderService;

    private Reminder dueReminder(Long id, Long interviewId) {
        Reminder reminder = new Reminder();
        reminder.setId(id);
        reminder.setTitle("Rappel J-1 — Sami Trabelsi / Développeur");
        reminder.setMessage("<html>ok</html>");
        reminder.setReminderDate(LocalDateTime.now().minusHours(1));
        reminder.setRelatedType(Reminder.RelatedType.INTERVIEW);
        reminder.setRelatedId(interviewId);
        reminder.setRecipientEmail("candidat@exemple.com");
        return reminder;
    }

    private Interview interviewWithStatus(Long id, Interview.InterviewStatus status) {
        Interview interview = new Interview();
        interview.setId(id);
        interview.setStatus(status);
        return interview;
    }

    @Nested
    @DisplayName("dispatchDueReminders()")
    class DispatchTests {

        @Test
        @DisplayName("un rappel dont l'entretien est terminé est purgé, sans e-mail")
        void purgesReminderOfCompletedInterview() {
            Reminder reminder = dueReminder(22L, 56L);
            when(reminderRepository.findBySentFalseAndReminderDateLessThanEqual(any()))
                    .thenReturn(List.of(reminder));
            when(interviewRepository.findById(56L))
                    .thenReturn(Optional.of(interviewWithStatus(56L, Interview.InterviewStatus.COMPLETED)));

            reminderService.dispatchDueReminders();

            verify(reminderRepository).delete(reminder);
            verify(emailService, never()).sendHtmlEmail(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("un rappel orphelin — son entretien a été supprimé — est purgé, sans e-mail")
        void purgesReminderOfDeletedInterview() {
            Reminder reminder = dueReminder(20L, 55L);
            when(reminderRepository.findBySentFalseAndReminderDateLessThanEqual(any()))
                    .thenReturn(List.of(reminder));
            when(interviewRepository.findById(55L)).thenReturn(Optional.empty());

            reminderService.dispatchDueReminders();

            verify(reminderRepository).delete(reminder);
            verify(emailService, never()).sendHtmlEmail(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("un entretien encore planifié reçoit bien son rappel, marqué envoyé")
        void sendsAndMarksReminderOfScheduledInterview() {
            Reminder reminder = dueReminder(17L, 53L);
            when(reminderRepository.findBySentFalseAndReminderDateLessThanEqual(any()))
                    .thenReturn(List.of(reminder));
            when(interviewRepository.findById(53L))
                    .thenReturn(Optional.of(interviewWithStatus(53L, Interview.InterviewStatus.SCHEDULED)));

            reminderService.dispatchDueReminders();

            verify(emailService).sendHtmlEmail(eq("candidat@exemple.com"),
                    eq("Rappel J-1 — Sami Trabelsi / Développeur"), eq("<html>ok</html>"));
            assertThat(reminder.isSent()).isTrue();
            assertThat(reminder.getSentAt()).isNotNull();
            verify(reminderRepository).save(reminder);
        }
    }

    @Nested
    @DisplayName("createInterviewReminders()")
    class CreateTests {

        private Interview plannableInterview() {
            Candidate candidate = new Candidate();
            candidate.setFirstName("Sami");
            candidate.setLastName("Trabelsi");
            candidate.setEmail("candidat@exemple.com");
            User interviewer = new User();
            interviewer.setUsername("manager.demo");
            interviewer.setEmail("manager@exemple.com");
            Interview interview = new Interview();
            interview.setId(53L);
            interview.setInterviewDate(LocalDateTime.now().plusDays(3).withHour(14).withMinute(30));
            interview.setType(Interview.InterviewType.TECHNICAL);
            interview.setLocation("Tunis");
            interview.setCandidate(candidate);
            interview.setInterviewer(interviewer);
            return interview;
        }

        @Test
        @DisplayName("re-planifier un entretien efface la vague précédente avant d'en créer une nouvelle")
        void replanningClearsThePreviousWave() {
            when(templateEngine.process(anyString(), any())).thenReturn("<html>rappel</html>");
            Reminder obsolete = dueReminder(11L, 53L);
            when(reminderRepository.findByRelatedTypeAndRelatedIdAndSentFalse(
                    Reminder.RelatedType.INTERVIEW, 53L)).thenReturn(List.of(obsolete));

            reminderService.createInterviewReminders(plannableInterview());

            verify(reminderRepository).deleteAll(List.of(obsolete));
            ArgumentCaptor<Reminder> created = ArgumentCaptor.forClass(Reminder.class);
            verify(reminderRepository, times(2)).save(created.capture());
            assertThat(created.getAllValues())
                    .extracting(Reminder::getRecipientEmail)
                    .containsExactly("candidat@exemple.com", "manager@exemple.com");
            assertThat(created.getAllValues())
                    .extracting(Reminder::getTitle)
                    .allMatch(title -> title.startsWith("Rappel J-1 — Sami Trabelsi")
                            || title.startsWith("Rappel H-2 — Sami Trabelsi"));
        }
    }
}
