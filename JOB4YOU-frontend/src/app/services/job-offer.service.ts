import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JobOffer } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class JobOfferService {
  private apiUrl = 'http://localhost:8080/api/job-offers';

  constructor(private http: HttpClient) {}

  getJobOffers(page: number = 0, size: number = 100, sortBy: string = 'createdAt', sortDir: string = 'desc'): Observable<JobOffer[]> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    return this.http.get<JobOffer[]>(this.apiUrl, { params });
  }

  getJobOfferById(id: number): Observable<JobOffer> {
    return this.http.get<JobOffer>(`${this.apiUrl}/${id}`);
  }

  // Nouvelle méthode pour récupérer une offre publique (pour les utilisateurs non connectés)
  getPublicJobOfferById(id: number): Observable<JobOffer> {
    return this.http.get<JobOffer>(`${this.apiUrl}/public/${id}`);
  }

  createJobOffer(jobOffer: any): Observable<JobOffer> {
    return this.http.post<JobOffer>(this.apiUrl, jobOffer);
  }

  updateJobOffer(id: number, jobOffer: any): Observable<JobOffer> {
    return this.http.put<JobOffer>(`${this.apiUrl}/${id}`, jobOffer);
  }

  deleteJobOffer(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }  updateJobOfferStatus(id: number, status: string): Observable<any> {
    console.log(`Service: updateJobOfferStatus appelé avec ID=${id}, status=${status}`);
    const params = new HttpParams().set('status', status);
    const url = `${this.apiUrl}/${id}/status`;
    console.log(`Service: URL complète = ${url}?status=${status}`);
    
    return this.http.put<any>(url, {}, { params });
  }

  getJobOffersByStatus(status: string, page: number = 0, size: number = 100): Observable<JobOffer[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<JobOffer[]>(`${this.apiUrl}/status/${status}`, { params });
  }

  getPublicJobOffers(page: number = 0, size: number = 100): Observable<JobOffer[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<JobOffer[]>(`${this.apiUrl}/public`, { params });
  }

  searchJobOffers(keyword: string): Observable<JobOffer[]> {
    return this.http.get<JobOffer[]>(`${this.apiUrl}/search`, { params: new HttpParams().set('keyword', keyword) });
  }

  searchJobOffersByLocation(location: string): Observable<JobOffer[]> {
    return this.http.get<JobOffer[]>(`${this.apiUrl}/search/location`, { params: new HttpParams().set('location', location) });
  }
}
