import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface Interviewer {
  id: number;
  name: string;
  role: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class InterviewerService {
  private apiUrl = 'http://localhost:8080/api/interviews/interviewers';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getInterviewers(): Observable<Interviewer[]> {
    return this.http.get<Interviewer[]>(this.apiUrl, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
