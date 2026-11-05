import { environment } from "../../environments/environment";
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GoldSetCaseView, GoldSetCalibrationReport } from '../models/interfaces';

/**
 * Atelier d'étalonnage du Gold Set : le corpus de référence, la mesure de la décision
 * et l'application d'un seuil calibré à un profil famille × niveau.
 * Réservé RH/Admin (le backend refuse les autres rôles).
 */
@Injectable({ providedIn: 'root' })
export class GoldSetService {
  private apiUrl = environment.apiUrl + '/gold-set';

  constructor(private http: HttpClient) {}

  listCases(): Observable<GoldSetCaseView[]> {
    return this.http.get<GoldSetCaseView[]>(`${this.apiUrl}/cases`);
  }

  /**
   * Le RH enrichit le corpus avec un dossier anonymisé dont il connaît la vérité terrain.
   * Le CV est traité comme une vraie candidature : même extraction, même score.
   */
  addCase(cv: File, caseRef: string, candidateName: string, jobOfferId: number,
          groundTruth: 'PERTINENT' | 'NON_PERTINENT', borderline: boolean): Observable<GoldSetCaseView> {
    const form = new FormData();
    form.append('cv', cv, cv.name);
    form.append('caseRef', caseRef);
    form.append('candidateName', candidateName);
    form.append('jobOfferId', String(jobOfferId));
    form.append('groundTruth', groundTruth);
    form.append('borderline', String(borderline));
    form.append('origin', 'EXTENSION_RH');
    return this.http.post<GoldSetCaseView>(`${this.apiUrl}/cases`, form);
  }

  /** Mesure sur les scores déjà enregistrés : aucun appel à l'IA, donc gratuit et instantané. */
  report(): Observable<GoldSetCalibrationReport> {
    return this.http.get<GoldSetCalibrationReport>(`${this.apiUrl}/report`);
  }

  /** Rejoue tout le corpus dans le circuit de décision (un appel IA par cas), puis mesure. */
  calibrate(): Observable<GoldSetCalibrationReport> {
    return this.http.post<GoldSetCalibrationReport>(`${this.apiUrl}/calibrate`, null, {
      params: new HttpParams().set('replay', true)
    });
  }

  applyThreshold(jobFamily: string, seniorityLevel: string, threshold: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/profiles/${jobFamily}/${seniorityLevel}/threshold`, null,
      { params: new HttpParams().set('threshold', threshold) });
  }

  resetThreshold(jobFamily: string, seniorityLevel: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/profiles/${jobFamily}/${seniorityLevel}/threshold`);
  }
}
