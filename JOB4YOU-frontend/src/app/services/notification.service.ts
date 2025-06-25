import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessageResponse, EmailResponse } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:8080/api/notifications';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Envoie un email de confirmation de candidature
   */
  sendApplicationConfirmation(candidateId: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/application-confirmation/${candidateId}`, 
      {},
      { headers: this.authService.getAuthHeaders() }
    );
  }

  /**
   * Envoie un email d'invitation à un entretien
   */
  sendInterviewInvitation(interviewId: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/interview-invitation/${interviewId}`, 
      {},
      { headers: this.authService.getAuthHeaders() }
    );
  }

  /**
   * Envoie un email de feedback au candidat
   */
  sendFeedbackNotification(feedbackId: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/feedback-notification/${feedbackId}`, 
      {},
      { headers: this.authService.getAuthHeaders() }
    );
  }

  /**
   * Envoie un email de feedback détaillé au candidat
   */
  sendDetailedFeedbackNotification(feedbackId: number, notificationData: FeedbackNotificationRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `http://localhost:8080/api/feedbacks/${feedbackId}/send-detailed-notification`,
      notificationData,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  /**
   * Envoie un email personnalisé
   */
  sendCustomEmail(emailData: CustomEmailRequest): Observable<EmailResponse> {
    return this.http.post<EmailResponse>(
      `${this.apiUrl}/custom-email`, 
      emailData,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  /**
   * Récupère l'historique des emails envoyés
   */
  getEmailHistory(candidateId?: number): Observable<EmailHistory[]> {
    const url = candidateId 
      ? `${this.apiUrl}/history/${candidateId}`
      : `${this.apiUrl}/history`;
    
    return this.http.get<EmailHistory[]>(url, {
      headers: this.authService.getAuthHeaders()
    });
  }
}

export interface CustomEmailRequest {
  to: string;
  subject: string;
  content: string;
  isHtml?: boolean;
}

export interface EmailHistory {
  id: number;
  to: string;
  subject: string;
  sentAt: Date;
  status: 'SENT' | 'FAILED' | 'PENDING';
  type: 'APPLICATION_CONFIRMATION' | 'INTERVIEW_INVITATION' | 'FEEDBACK_NOTIFICATION' | 'CUSTOM';
}

export interface FeedbackNotificationRequest {
  candidateId: number;
  feedbackId: number;
  decision: string;
  comments: string;
  nextSteps?: string;
}

