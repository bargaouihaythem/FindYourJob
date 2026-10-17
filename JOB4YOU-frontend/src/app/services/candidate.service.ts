import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Candidate, RoutingPreview, RoutingStatus } from '../models/interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private apiUrl = environment.apiUrl + '/candidates';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getCandidates(page: number = 0, size: number = 100, sortBy: string = 'applicationDate', sortDir: string = 'desc'): Observable<Candidate[]> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    return this.http.get<Candidate[]>(this.apiUrl, { params });
  }

  getCandidateById(id: number): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.apiUrl}/${id}`);
  }

  createCandidate(candidate: any): Observable<Candidate> {
    if (this.authService.isAuthenticated()) {
      const token = this.authService.getToken();
      let headers = new HttpHeaders();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      return this.http.post<Candidate>(this.apiUrl + '/apply', candidate, { headers });
    } else {
      // Candidature publique : pas de header
      return this.http.post<Candidate>(this.apiUrl + '/apply', candidate);
    }
  }
  updateCandidate(id: number, candidate: any): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    return this.http.put<Candidate>(`${this.apiUrl}/${id}`, candidate, { headers });
  }
  deleteCandidate(id: number): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.delete(`${this.apiUrl}/${id}`, { headers });
  }
  updateCandidateStatus(id: number, status: string, reason?: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    let params = new HttpParams().set('status', status);
    if (reason?.trim()) params = params.set('reason', reason.trim());
    return this.http.patch<Candidate>(`${this.apiUrl}/${id}/status`, null, { params, headers });
  }

  /**
   * Avis du manager sur un dossier déjà validé par le RH (ACCEPTED ou REJECTED).
   * Le backend vérifie que le dossier est bien au périmètre du manager et déjà
   * validé (statut >= CV_REVIEWED). L'avis n'est pas la décision finale : il est
   * contre-signé par le RH via finalValidation(), qui seul notifie le candidat.
   */
  managerDecision(id: number, decision: 'ACCEPTED' | 'REJECTED', reason?: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    let params = new HttpParams().set('decision', decision);
    if (reason?.trim()) params = params.set('reason', reason.trim());
    return this.http.patch<Candidate>(`${this.apiUrl}/${id}/manager-decision`, null, { params, headers });
  }

  /**
   * Validation finale RH d'un avis manager : HIRED (date de présentation des documents
   * obligatoire) ou REJECTED (motif obligatoire). Réservé au RH/Admin.
   */
  finalValidation(id: number, decision: 'HIRED' | 'REJECTED', presentationDate?: string, reason?: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    let params = new HttpParams().set('decision', decision);
    if (presentationDate) params = params.set('presentationDate', presentationDate);
    if (reason?.trim()) params = params.set('reason', reason.trim());
    return this.http.patch<Candidate>(`${this.apiUrl}/${id}/final-validation`, null, { params, headers });
  }

  withdrawApplication(id: number, reason?: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    let params = new HttpParams();
    if (reason?.trim()) params = params.set('reason', reason.trim());
    return this.http.post<Candidate>(`${this.apiUrl}/${id}/withdraw`, null, { params, headers });
  }

  /**
   * Correction manuelle du score IA par le RH/Admin, avec justification obligatoire.
   */
  overrideAiScore(id: number, manualScore: number, reason: string): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    const params = new HttpParams().set('manualScore', manualScore).set('reason', reason);
    return this.http.patch<Candidate>(`${this.apiUrl}/${id}/ai-score/override`, null, { params, headers });
  }

  /**
   * Relance l'analyse IA d'un dossier : exactement le chemin emprunté par l'Agent 1
   * n8n à la réception d'une candidature (Cohere, avec repli simulé).
   */
  recomputeAiScore(id: number): Observable<Candidate> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post<Candidate>(`${this.apiUrl}/${id}/ai-score/recompute`, null, { headers });
  }

  uploadCV(candidateId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cv', file);
    return this.http.post<any>(`${environment.apiUrl}/cvs/upload/${candidateId}`, formData);
  }

  getCandidatesByEmail(email: string): Observable<Candidate[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<Candidate[]>(`${this.apiUrl}/by-email/${email}`, { headers });
  }

  /**
   * Vue Manager : retourne uniquement les dossiers validés par RH (statut CV_REVIEWED ou plus).
   * MANAGER : peut analyser CV, score IA, donner feedback technique.
   * N'inclut PAS les candidatures en statut APPLIED (pas encore examinées par RH).
   */
  getValidatedCandidates(): Observable<Candidate[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<Candidate[]>(`${this.apiUrl}/validated`, { headers });
  }

  exportCandidatePdf(id: number): Observable<Blob> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/${id}/export/pdf`, { headers, responseType: 'blob' });
  }

  /**
   * Où partira le dossier si le RH confirme la transmission : destinataires résolus
   * par ManagerRoutingService (ou destination déjà figée sur le dossier). Lecture
   * seule, aucun envoi.
   */
  getRoutingPreview(id: number): Observable<RoutingPreview> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<RoutingPreview>(`${this.apiUrl}/${id}/routing-preview`, { headers });
  }

  /**
   * Trace RH de la transmission : destinataires figés sur le dossier et, pour chacun,
   * l'état de la notification dans l'outbox n8n. « SENT » = webhook n8n ayant accepté
   * l'événement ; la remise dans la boîte du manager n'est pas tracée ici.
   */
  getRoutingStatus(id: number): Observable<RoutingStatus> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<RoutingStatus>(`${this.apiUrl}/${id}/routing-status`, { headers });
  }

  /**
   * Relance la notification des destinataires déjà figés — utile quand un envoi est
   * passé en FAILED ou est resté en file. La destination, elle, ne change pas.
   */
  rerouteNotification(id: number): Observable<RoutingStatus> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post<RoutingStatus>(`${this.apiUrl}/${id}/reroute-notification`, null, { headers });
  }
}
