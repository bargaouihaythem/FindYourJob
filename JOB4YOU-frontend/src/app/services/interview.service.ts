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
    // Vérification des rôles admin d'abord
    if (userRoles.includes('ROLE_ADMIN') || userRoles.includes('ADMIN')) {
      return true; // Admin peut tout faire
    }

    // Vérification des rôles RH et Manager
    const hasHRRole = userRoles.includes('ROLE_HR') || userRoles.includes('HR') || userRoles.includes('RH');
    const hasManagerRole = userRoles.includes('ROLE_MANAGER') || userRoles.includes('MANAGER');
    const hasTeamRole = userRoles.includes('ROLE_TEAM_LEAD') || userRoles.includes('TEAM_LEAD') || 
                       userRoles.includes('ROLE_SENIOR_DEV') || userRoles.includes('SENIOR_DEV') ||
                       userRoles.includes('ROLE_TEAM') || userRoles.includes('TEAM');

    // Workflow d'entretien simplifié mais plus permissif
    if (hasHRRole || hasManagerRole || hasTeamRole) {
      // Ces rôles peuvent faire la plupart des transitions
      switch (currentStatus) {
        case 'SCHEDULED':
          return ['IN_PROGRESS', 'CANCELLED', 'RESCHEDULED'].includes(newStatus);
        case 'IN_PROGRESS':
          return ['COMPLETED', 'CANCELLED', 'RESCHEDULED'].includes(newStatus);
        case 'COMPLETED':
          return ['CANCELLED'].includes(newStatus); // Permettre l'annulation même après completion si nécessaire
        case 'CANCELLED':
          return ['SCHEDULED', 'RESCHEDULED'].includes(newStatus); // Permettre de reprogrammer
        case 'RESCHEDULED':
          return ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'].includes(newStatus);
        default:
          return false;
      }
    }

    return false;
  }
}