import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Department } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = 'http://localhost:8080/api/departments';

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.apiUrl);
  }
}
