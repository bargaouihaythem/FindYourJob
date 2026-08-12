import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JobMatch } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class MatchingService {
  private apiUrl = environment.apiUrl + '/matching';

  constructor(private http: HttpClient) {}

  suggestOffers(file: File): Observable<JobMatch[]> {
    const formData = new FormData();
    formData.append('cv', file);
    return this.http.post<JobMatch[]>(`${this.apiUrl}/upload-cv`, formData);
  }
}
