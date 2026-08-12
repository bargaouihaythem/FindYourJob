import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl + '/users';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  /** Accessible RH/Manager/Admin (contrairement à getAllUsers, réservé Admin). */
  getInterviewers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/interviewers`);
  }

  assignDepartment(userId: number, departmentId: number): Observable<User> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.patch<User>(`${this.apiUrl}/${userId}/department`, {}, { params });
  }

  assignJobFamily(userId: number, jobFamily: string): Observable<User> {
    const params = new HttpParams().set('jobFamily', jobFamily);
    return this.http.patch<User>(`${this.apiUrl}/${userId}/job-family`, {}, { params });
  }
}
