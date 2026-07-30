import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  assignDepartment(userId: number, departmentId: number): Observable<User> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.patch<User>(`${this.apiUrl}/${userId}/department`, {}, { params });
  }
}
