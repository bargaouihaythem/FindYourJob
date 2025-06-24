import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Candidate } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private apiUrl = 'http://localhost:8080/api/candidates';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getCandidates(page: number = 0, size: number = 100, sortBy: string = 'applicationDate', sortDir: string = 'desc'): Observable<Candidate[]> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    return this.http.get<Candidate[]>(this.apiUrl, { params });
  }

  getCandidateById(id: number): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.apiUrl}/${id}`);
  }

  createCandidate(candidate: any): Observable<Candidate> {
    if (this.authService.isAuthenticated()) {
      const token = this.authService.getToken();
      let headers = new HttpHeaders();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      return this.http.post<Candidate>(this.apiUrl + '/apply', candidate, { headers });
    } else {
      // Candidature publique : pas de header
      return this.http.post<Candidate>(this.apiUrl + '/apply', candidate);
    }
  }
  updateCandidate(id: number, candidate: any): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    return this.http.put<Candidate>(`${this.apiUrl}/${id}`, candidate, { headers });
  }
  deleteCandidate(id: number): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.delete(`${this.apiUrl}/${id}`, { headers });
  }
  updateCandidateStatus(id: number, status: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    return this.http.patch<Candidate>(`${this.apiUrl}/${id}/status`, null, { 
      params: new HttpParams().set('status', status),
      headers 
    });
  }

  uploadCV(candidateId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cv', file);
    return this.http.post<any>(`http://localhost:8080/api/cvs/upload/${candidateId}`, formData);
  }

  getCandidatesByEmail(email: string): Observable<Candidate[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<Candidate[]>(`${this.apiUrl}/by-email/${email}`, { headers });
  }
}
