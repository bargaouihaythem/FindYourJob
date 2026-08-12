import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Department } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = environment.apiUrl + '/departments';

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.apiUrl);
  }
}
