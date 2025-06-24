import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CVResponse {
  id: number;
  candidateId: number;
  fileName?: string;
  originalFilename?: string;
  storedFilename?: string;
  filePath?: string;
  fileUrl?: string;
  fileSize?: number;
  uploadDate?: Date;
  downloadUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CVService {
  private apiUrl = 'http://localhost:8080/api/cvs';

  constructor(private http: HttpClient) {}

  uploadCV(candidateId: number, file: File): Observable<CVResponse> {
    const formData = new FormData();
    formData.append('cv', file);
    
    return this.http.post<CVResponse>(`${this.apiUrl}/upload/${candidateId}`, formData);
  }

  /**
   * Soumission d'une candidature avec CV (application + fichier)
   */
  submitApplication(applicationData: any, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('application', JSON.stringify(applicationData)); // nom du champ exactement 'application'
    formData.append('cv', file); // nom du champ exactement 'cv'
    return this.http.post<any>('http://localhost:8080/api/candidates/apply', formData);
  }

  getCVByCandidate(candidateId: number): Observable<CVResponse> {
    return this.http.get<CVResponse>(`${this.apiUrl}/candidate/${candidateId}`);
  }

  getCVById(id: number): Observable<CVResponse> {
    return this.http.get<CVResponse>(`${this.apiUrl}/${id}`);
  }

  getCVsByJobOffer(jobOfferId: number): Observable<CVResponse[]> {
    return this.http.get<CVResponse[]>(`${this.apiUrl}/job-offer/${jobOfferId}`);
  }

  deleteCV(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getCVDownloadUrl(candidateId: number): Observable<string> {
    return this.http.get(`${this.apiUrl}/candidate/${candidateId}/view`, { responseType: 'text' });
  }

  candidateHasCV(candidateId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/candidate/${candidateId}/exists`);
  }

  /**
   * Récupère un fichier via une requête HTTP authentifiée (retourne un Blob)
   */
  getFileBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(fileUrl, { responseType: 'blob' });
  }

  /**
   * Télécharge un fichier via une requête HTTP authentifiée
   */
  downloadFile(fileUrl: string): Observable<Blob> {
    return this.http.get(fileUrl, { 
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': 'application/octet-stream'
      })
    });
  }
}

