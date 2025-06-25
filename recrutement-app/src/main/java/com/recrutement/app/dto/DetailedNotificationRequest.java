package com.recrutement.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DetailedNotificationRequest {
    
    @NotBlank(message = "Le sujet ne peut pas être vide")
    @Size(max = 200, message = "Le sujet ne peut pas dépasser 200 caractères")
    private String subject;
    
    @NotBlank(message = "Le message ne peut pas être vide")
    @Size(max = 2000, message = "Le message ne peut pas dépasser 2000 caractères")
    private String message;
    
    @Size(max = 1000, message = "Les détails de l'entretien ne peuvent pas dépasser 1000 caractères")
    private String interviewDetails;
    
    @Size(max = 1000, message = "Le résumé du feedback ne peut pas dépasser 1000 caractères")
    private String feedbackSummary;
    
    // Constructeurs
    public DetailedNotificationRequest() {}
    
    public DetailedNotificationRequest(String subject, String message, String interviewDetails, String feedbackSummary) {
        this.subject = subject;
        this.message = message;
        this.interviewDetails = interviewDetails;
        this.feedbackSummary = feedbackSummary;
    }
    
    // Getters et Setters
    public String getSubject() {
        return subject;
    }
    
    public void setSubject(String subject) {
        this.subject = subject;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public String getInterviewDetails() {
        return interviewDetails;
    }
    
    public void setInterviewDetails(String interviewDetails) {
        this.interviewDetails = interviewDetails;
    }
    
    public String getFeedbackSummary() {
        return feedbackSummary;
    }
    
    public void setFeedbackSummary(String feedbackSummary) {
        this.feedbackSummary = feedbackSummary;
    }
}
