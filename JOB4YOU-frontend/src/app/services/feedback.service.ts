import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Feedback } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = 'http://localhost:8080/api/feedbacks';

  constructor(private http: HttpClient) {}

  getFeedbacks(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.apiUrl);
  }

  getFeedbackById(id: number): Observable<Feedback> {
    return this.http.get<Feedback>(`${this.apiUrl}/${id}`);
  }

  getFeedbacksByCandidate(candidateId: number): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/candidate/${candidateId}`);
  }

  getFeedbacksByInterview(interviewId: number): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/interview/${interviewId}`);
  }

  createFeedback(feedback: any): Observable<Feedback> {
    return this.http.post<Feedback>(this.apiUrl, feedback);
  }

  updateFeedback(id: number, feedback: any): Observable<Feedback> {
    return this.http.put<Feedback>(`${this.apiUrl}/${id}`, feedback);
  }

  deleteFeedback(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getPendingFeedbacks(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(`${this.apiUrl}/pending`);
  }

  approveFeedback(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/approve`, {});
  }

  rejectFeedback(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/reject`, {});
  }

  markFeedbackAsSent(id: number): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/mark-sent`, {});
  }

  updateFeedbackStatus(id: number, status: string): Observable<Feedback> {
    return this.http.patch<Feedback>(`${this.apiUrl}/${id}/status`, null, { params: { status } });
  }

  sendFeedbackToCandidate(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/send-to-candidate`, {});
  }
}
