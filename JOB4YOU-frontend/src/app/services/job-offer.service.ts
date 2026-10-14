import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DepartmentProposal, JobOffer, ManagerOption, RoutingPreview } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class JobOfferService {
  private apiUrl = environment.apiUrl + '/job-offers';

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

  /**
   * Managers désignables comme recruteurs : ceux du département choisi en tête de liste.
   * Une aide pour le RH, jamais un choix automatique.
   */
  getAssignableManagers(departmentId?: number | null): Observable<ManagerOption[]> {
    let params = new HttpParams();
    if (departmentId != null) params = params.set('departmentId', departmentId);
    return this.http.get<ManagerOption[]>(`${this.apiUrl}/manager-candidates`, { params });
  }

  /** Où partiraient les candidatures de cette offre si le RH les transmettait maintenant. */
  getRoutingPreview(id: number): Observable<RoutingPreview> {
    return this.http.get<RoutingPreview>(`${this.apiUrl}/${id}/routing-preview`);
  }

  /** Départements suggérés pour une offre non rattachée ; le RH doit confirmer. */
  getDepartmentProposals(id: number): Observable<DepartmentProposal[]> {
    return this.http.get<DepartmentProposal[]>(`${this.apiUrl}/${id}/department-proposals`);
  }
}
