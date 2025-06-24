import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoginRequest, SignupRequest, JwtResponse, MessageResponse, User } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Vérifier si un token existe au démarrage
    this.checkStoredToken();
  }

  private checkStoredToken(): void {
    const token = this.getToken();
    if (token) {
      // Décoder le token pour obtenir les informations utilisateur
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const user: User = {
          id: payload.id,
          username: payload.sub,
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          roles: payload.roles || []
        };
        this.currentUserSubject.next(user);
      } catch (error) {
        // Token invalide, le supprimer
        this.logout();
      }
    }
  }

  login(credentials: LoginRequest): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(`${this.apiUrl}/signin`, credentials)
      .pipe(
        tap(response => {
          // Stocker le token
          localStorage.setItem('token', response.token);
          
          // Créer l'objet utilisateur
          const user: User = {
            id: response.id,
            username: response.username,
            email: response.email,
            firstName: '',
            lastName: '',
            roles: response.roles
          };
          
          this.currentUserSubject.next(user);
        })
      );
  }

  register(userData: SignupRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/signup`, userData);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convertir en millisecondes
      return Date.now() < exp;
    } catch {
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.roles.includes(role) : false;
  }

  isAdmin(): boolean {
    return this.hasRole('ROLE_ADMIN');
  }

  isHR(): boolean {
    return this.hasRole('ROLE_HR');
  }

  isManager(): boolean {
    return this.hasRole('ROLE_MANAGER');
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }
}

