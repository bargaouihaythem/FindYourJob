import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth';
import { User } from '../models/interfaces';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Génère un JWT signé avec un payload quelconque (signature fictive) */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake_signature`;
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600; // expire dans 1h
const PAST_EXP   = Math.floor(Date.now() / 1000) - 3600; // expiré il y a 1h

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // ── Instanciation ────────────────────────────
  it('devrait être créé', () => {
    expect(service).toBeTruthy();
  });

  // ── isAuthenticated ──────────────────────────
  describe('isAuthenticated()', () => {
    it('retourne false sans token', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('retourne true avec un token valide (non expiré)', () => {
      const token = makeJwt({ sub: 'user', exp: FUTURE_EXP, roles: [] });
      localStorage.setItem('token', token);
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('retourne false avec un token expiré', () => {
      const token = makeJwt({ sub: 'user', exp: PAST_EXP, roles: [] });
      localStorage.setItem('token', token);
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('retourne false avec un token malformé', () => {
      localStorage.setItem('token', 'not_a_valid_jwt');
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  // ── hasRole / rôles ──────────────────────────
  describe('hasRole() / isAdmin() / isHR() / isManager() / isCandidate()', () => {
    function setUser(roles: string[]): void {
      const token = makeJwt({ sub: 'test', exp: FUTURE_EXP, id: 1, roles });
      localStorage.setItem('token', token);
      // Simuler ce que checkStoredToken() fait au démarrage
      (service as any).currentUserSubject.next({ id: 1, username: 'test', email: '', firstName: '', lastName: '', roles } as User);
    }

    it('isAdmin() → true si ROLE_ADMIN', () => {
      setUser(['ROLE_ADMIN']);
      expect(service.isAdmin()).toBeTrue();
    });

    it('isAdmin() → false si ROLE_USER', () => {
      setUser(['ROLE_USER']);
      expect(service.isAdmin()).toBeFalse();
    });

    it('isHR() → true si ROLE_HR', () => {
      setUser(['ROLE_HR']);
      expect(service.isHR()).toBeTrue();
    });

    it('isManager() → true si ROLE_MANAGER', () => {
      setUser(['ROLE_MANAGER']);
      expect(service.isManager()).toBeTrue();
    });

    it('isCandidate() → true si ROLE_USER', () => {
      setUser(['ROLE_USER']);
      expect(service.isCandidate()).toBeTrue();
    });

    it('isCandidate() → false si ROLE_HR', () => {
      setUser(['ROLE_HR']);
      expect(service.isCandidate()).toBeFalse();
    });

    it('isCandidate() → false si non connecté', () => {
      expect(service.isCandidate()).toBeFalse();
    });

    it('isManager() + isHR() → logique de vue manager (mode exclusif)', () => {
      // Un utilisateur avec les deux rôles n'est PAS en vue manager pure
      setUser(['ROLE_MANAGER', 'ROLE_HR']);
      const isManagerView = service.isManager() && !service.isHR() && !service.isAdmin();
      expect(isManagerView).toBeFalse();
    });

    it('isManager() seul → vue manager activée', () => {
      setUser(['ROLE_MANAGER']);
      const isManagerView = service.isManager() && !service.isHR() && !service.isAdmin();
      expect(isManagerView).toBeTrue();
    });
  });

  // ── getToken ─────────────────────────────────
  describe('getToken()', () => {
    it('retourne null quand aucun token', () => {
      expect(service.getToken()).toBeNull();
    });

    it('retourne le token depuis localStorage', () => {
      localStorage.setItem('token', 'tok123');
      expect(service.getToken()).toBe('tok123');
    });

    it('retourne le token depuis sessionStorage si absent du localStorage', () => {
      sessionStorage.setItem('token', 'session_tok');
      expect(service.getToken()).toBe('session_tok');
    });

    it('localStorage a priorité sur sessionStorage', () => {
      localStorage.setItem('token', 'local_tok');
      sessionStorage.setItem('token', 'session_tok');
      expect(service.getToken()).toBe('local_tok');
    });
  });

  // ── logout ───────────────────────────────────
  describe('logout()', () => {
    it('supprime le token et remet currentUser à null', () => {
      localStorage.setItem('token', 'some_token');
      (service as any).currentUserSubject.next({ id: 1, username: 'u', email: '', firstName: '', lastName: '', roles: [] } as User);

      service.logout();

      expect(service.getToken()).toBeNull();
      expect(service.getCurrentUser()).toBeNull();
    });

    it('conserve les infos "se souvenir de moi" après logout', () => {
      localStorage.setItem('rememberedUsername', 'alice');
      localStorage.setItem('rememberMe', 'true');

      service.logout();

      expect(localStorage.getItem('rememberedUsername')).toBe('alice');
      expect(localStorage.getItem('rememberMe')).toBe('true');
    });
  });

  // ── getAuthHeaders ───────────────────────────
  describe('getAuthHeaders()', () => {
    it('retourne Authorization: Bearer <token> si connecté', () => {
      localStorage.setItem('token', 'mytoken');
      const headers = service.getAuthHeaders();
      expect(headers.get('Authorization')).toBe('Bearer mytoken');
    });

    it("retourne Authorization vide si pas de token", () => {
      const headers = service.getAuthHeaders();
      expect(headers.get('Authorization')).toBe('');
    });
  });
});
