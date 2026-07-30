import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ScoringWeightProfile, ScoringWeightProfileRequest } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class ScoringProfileService {
  private apiUrl = 'http://localhost:8080/api/scoring-profiles';

  constructor(private http: HttpClient) {}

  getAll(): Observable<ScoringWeightProfile[]> {
    return this.http.get<ScoringWeightProfile[]>(this.apiUrl);
  }

  upsert(jobFamily: string, seniorityLevel: string, request: ScoringWeightProfileRequest): Observable<ScoringWeightProfile> {
    return this.http.put<ScoringWeightProfile>(`${this.apiUrl}/${jobFamily}/${seniorityLevel}`, request);
  }
}
