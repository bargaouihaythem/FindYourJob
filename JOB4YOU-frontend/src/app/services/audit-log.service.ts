import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLog } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private apiUrl = 'http://localhost:8080/api/audit';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getCandidateHistory(candidateId: number): Observable<AuditLog[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<AuditLog[]>(`${this.apiUrl}/candidate/${candidateId}`, { headers });
  }

  getRecent(limit: number = 50): Observable<AuditLog[]> {
    const headers = this.authService.getAuthHeaders();
    const params = new HttpParams().set('limit', limit);
    return this.http.get<AuditLog[]>(`${this.apiUrl}/recent`, { headers, params });
  }
}
