package com.recrutement.app.dto;

import com.recrutement.app.entity.Reminder;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReminderResponse {

    private Long id;
    private String title;
    private LocalDateTime reminderDate;
    private String relatedType;
    private Long relatedId;
    private boolean sent;
    private LocalDateTime sentAt;
    private String recipientEmail;

    public ReminderResponse(Reminder reminder) {
        this.id = reminder.getId();
        this.title = reminder.getTitle();
        this.reminderDate = reminder.getReminderDate();
        this.relatedType = reminder.getRelatedType() != null ? reminder.getRelatedType().name() : null;
        this.relatedId = reminder.getRelatedId();
        this.sent = reminder.isSent();
        this.sentAt = reminder.getSentAt();
        this.recipientEmail = reminder.getRecipientEmail();
    }
}
