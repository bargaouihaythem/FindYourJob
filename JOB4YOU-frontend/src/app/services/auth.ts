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

  /**
   * Sauvegarde les informations de connexion si "Se souvenir de moi" est activé
   */
  private saveLoginCredentials(username: string, rememberMe: boolean): void {
    if (rememberMe) {
      localStorage.setItem('rememberedUsername', username);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberedUsername');
      localStorage.removeItem('rememberMe');
    }
  }

  /**
   * Récupère le nom d'utilisateur sauvegardé
   */
  getRememberedUsername(): string | null {
    return localStorage.getItem('rememberedUsername');
  }

  /**
   * Vérifie si "Se souvenir de moi" était activé
   */
  isRememberMeEnabled(): boolean {
    return localStorage.getItem('rememberMe') === 'true';
  }

  /**
   * Sauvegarde le token avec la durée appropriée selon "Se souvenir de moi"
   */
  private saveToken(token: string, rememberMe: boolean): void {
    if (rememberMe) {
      // Utiliser localStorage pour une persistance plus longue
      localStorage.setItem('token', token);
      localStorage.setItem('tokenType', 'persistent');
    } else {
      // Utiliser sessionStorage pour la session courante uniquement
      sessionStorage.setItem('token', token);
      localStorage.setItem('tokenType', 'session');
      // Supprimer le token persistent s'il existe
      localStorage.removeItem('token');
    }
  }

  /**
   * Récupère le token depuis le storage approprié
   */
  getToken(): string | null {
    // Vérifier d'abord localStorage, puis sessionStorage
    let token = localStorage.getItem('token');
    if (!token) {
      token = sessionStorage.getItem('token');
    }
    return token;
  }

  login(credentials: LoginRequest, rememberMe: boolean = false): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(`${this.apiUrl}/signin`, credentials)
      .pipe(
        tap(response => {
          // Stocker le token avec la méthode appropriée
          this.saveToken(response.token, rememberMe);
          
          // Sauvegarder les informations de connexion si demandé
          this.saveLoginCredentials(credentials.username, rememberMe);
          
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

  requestPasswordReset(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(resetCode: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/reset-password`, { 
      resetCode, 
      newPassword 
    });
  }

  logout(): void {
    // Nettoyer tous les tokens
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('tokenType');
    
    // Ne pas supprimer les informations "Se souvenir de moi" lors de la déconnexion
    // Elles doivent persister pour la prochaine connexion
    
    this.currentUserSubject.next(null);
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

  /**
   * Efface les informations de connexion mémorisées
   */
  clearRememberedCredentials(): void {
    localStorage.removeItem('rememberedUsername');
    localStorage.removeItem('rememberMe');
  }
}

