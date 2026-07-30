import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InternalNote } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class InternalNoteService {
  private apiUrl = 'http://localhost:8080/api/internal-notes';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getNotesForCandidate(candidateId: number): Observable<InternalNote[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<InternalNote[]>(`${this.apiUrl}/candidate/${candidateId}`, { headers });
  }

  createNote(candidateId: number, content: string): Observable<InternalNote> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post<InternalNote>(this.apiUrl, { candidateId, content }, { headers });
  }

  updateNote(id: number, candidateId: number, content: string): Observable<InternalNote> {
    const headers = this.authService.getAuthHeaders();
    return this.http.put<InternalNote>(`${this.apiUrl}/${id}`, { candidateId, content }, { headers });
  }

  deleteNote(id: number): Observable<void> {
    const headers = this.authService.getAuthHeaders();
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers });
  }

  togglePin(id: number): Observable<InternalNote> {
    const headers = this.authService.getAuthHeaders();
    return this.http.patch<InternalNote>(`${this.apiUrl}/${id}/pin`, {}, { headers });
  }
}
