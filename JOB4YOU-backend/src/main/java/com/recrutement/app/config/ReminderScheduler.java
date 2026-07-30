package com.recrutement.app.config;

import com.recrutement.app.service.ReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Vérifie toutes les heures les rappels dus et envoie les emails correspondants. */
@Component
public class ReminderScheduler {

    @Autowired
    private ReminderService reminderService;

    @Scheduled(cron = "0 0 * * * *")
    public void dispatchDueReminders() {
        reminderService.dispatchDueReminders();
    }
}
