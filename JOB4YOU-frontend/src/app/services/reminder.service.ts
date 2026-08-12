import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reminder } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  private apiUrl = environment.apiUrl + '/reminders';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getAll(): Observable<Reminder[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<Reminder[]>(this.apiUrl, { headers });
  }

  getTodayReminders(): Observable<Reminder[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<Reminder[]>(`${this.apiUrl}/today`, { headers });
  }
}
