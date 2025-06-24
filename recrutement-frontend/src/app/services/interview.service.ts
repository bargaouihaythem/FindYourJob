import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Interview } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class InterviewService {
  private apiUrl = 'http://localhost:8080/api/interviews';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getInterviews(): Observable<Interview[]> {
    return this.http.get<Interview[]>(this.apiUrl, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getInterviewById(id: number): Observable<Interview> {
    return this.http.get<Interview>(`${this.apiUrl}/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  createInterview(interview: any): Observable<Interview> {
    return this.http.post<Interview>(this.apiUrl, interview, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateInterview(id: number, interview: any): Observable<Interview> {
    return this.http.put<Interview>(`${this.apiUrl}/${id}`, interview, {
      headers: this.authService.getAuthHeaders()
    });
  }

  deleteInterview(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateInterviewStatus(id: number, status: string): Observable<Interview> {
    return this.http.patch<Interview>(`${this.apiUrl}/${id}/status`, null, { params: new HttpParams().set('status', status) });
  }

  getInterviewsByCandidate(candidateId: number): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/candidate/${candidateId}`);
  }

  getInterviewsByInterviewer(interviewerId: number): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/interviewer/${interviewerId}`);
  }

  getInterviewsByStatus(status: string): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/status/${status}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getInterviewsByType(type: string): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/type/${type}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getInterviewsByDateRange(startDate: string, endDate: string): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/date-range`, { 
      params: new HttpParams().set('startDate', startDate).set('endDate', endDate),
      headers: this.authService.getAuthHeaders()
    });
  }

  getInterviewsByEmail(email: string): Observable<Interview[]> {
    return this.http.get<Interview[]>(`${this.apiUrl}/by-email/${email}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  /**
   * Vérifie si l'utilisateur courant a le droit de changer le statut d'un entretien selon le workflow RH/Manager/Admin
   * @param currentStatus Statut actuel de l'entretien
   * @param newStatus Statut souhaité
   * @param userRoles Rôles de l'utilisateur courant
   */
  canChangeStatus(currentStatus: string, newStatus: string, userRoles: string[]): boolean {
    // Exemple de workflow :
    // RH peut passer de SCHEDULED à IN_PROGRESS ou CANCELLED
    // Manager peut passer de IN_PROGRESS à COMPLETED
    // RH peut passer de COMPLETED à FEEDBACK_SENT
    if (userRoles.includes('ROLE_HR')) {
      if (currentStatus === 'SCHEDULED' && (newStatus === 'IN_PROGRESS' || newStatus === 'CANCELLED')) return true;
      if (currentStatus === 'COMPLETED' && newStatus === 'FEEDBACK_SENT') return true;
    }
    if (userRoles.includes('ROLE_MANAGER')) {
      if (currentStatus === 'IN_PROGRESS' && newStatus === 'COMPLETED') return true;
    }
    if (userRoles.includes('ROLE_ADMIN')) {
      return true; // Admin peut tout faire
    }
    return false;
  }
}