import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Feedback } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = 'http://localhost:8080/api/feedbacks';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getFeedbacks(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.apiUrl, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getFeedbackById(id: number): Observable<Feedback> {
    return this.http.get<Feedback>(`${this.apiUrl}/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getFeedbacksByCandidate(candidateId: number): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/candidate/${candidateId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getFeedbacksByInterview(interviewId: number): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/interview/${interviewId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  createFeedback(feedback: any): Observable<Feedback> {
    return this.http.post<Feedback>(this.apiUrl, feedback, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateFeedback(id: number, feedback: any): Observable<Feedback> {
    return this.http.put<Feedback>(`${this.apiUrl}/${id}`, feedback, {
      headers: this.authService.getAuthHeaders()
    });
  }

  deleteFeedback(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getPendingFeedbacks(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/pending`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  approveFeedback(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/approve`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }

  rejectFeedback(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/reject`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }

  markFeedbackAsSent(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/mark-sent`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateFeedbackStatus(id: number, status: string): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/status`, null, { 
      params: { status },
      headers: this.authService.getAuthHeaders()
    });
  }

  sendFeedbackToCandidate(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/send-to-candidate`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
