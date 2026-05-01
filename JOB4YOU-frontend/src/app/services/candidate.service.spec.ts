import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CandidateService } from './candidate.service';
import { AuthService } from './auth';
import { HttpHeaders } from '@angular/common/http';

// ─────────────────────────────────────────────
// Mock AuthService
// ─────────────────────────────────────────────

class MockAuthService {
  private _token: string | null = null;
  private _authenticated = false;

  setToken(t: string | null) { this._token = t; this._authenticated = !!t; }

  isAuthenticated() { return this._authenticated; }
  getToken() { return this._token; }
  getAuthHeaders() {
    return new HttpHeaders({ Authorization: this._token ? `Bearer ${this._token}` : '' });
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('CandidateService', () => {
  let service: CandidateService;
  let httpMock: HttpTestingController;
  let mockAuth: MockAuthService;

  const API = 'http://localhost:8080/api/candidates';

  beforeEach(() => {
    mockAuth = new MockAuthService();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CandidateService,
        { provide: AuthService, useValue: mockAuth }
      ]
    });
    service = TestBed.inject(CandidateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // aucune requête HTTP non gérée
  });

  // ── Instanciation ────────────────────────────
  it('devrait être créé', () => {
    expect(service).toBeTruthy();
  });

  // ── getCandidates ────────────────────────────
  describe('getCandidates()', () => {
    it('appelle GET /api/candidates avec les bons paramètres de pagination par défaut', () => {
      service.getCandidates().subscribe();
      const req = httpMock.expectOne(r => r.url === API && r.method === 'GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('100');
      req.flush([]);
    });
  });

  // ── getCandidateById ─────────────────────────
  describe('getCandidateById()', () => {
    it('appelle GET /api/candidates/42', () => {
      service.getCandidateById(42).subscribe();
      const req = httpMock.expectOne(`${API}/42`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 42 });
    });
  });

  // ── updateCandidateStatus ─────────────────────
  describe('updateCandidateStatus()', () => {
    it('appelle PATCH /api/candidates/5/status avec le paramètre status', () => {
      mockAuth.setToken('token_rh');
      service.updateCandidateStatus(5, 'CV_REVIEWED').subscribe();
      const req = httpMock.expectOne(r => r.url === `${API}/5/status` && r.method === 'PATCH');
      expect(req.request.params.get('status')).toBe('CV_REVIEWED');
      req.flush({ id: 5, status: 'CV_REVIEWED' });
    });

    it("envoie l'en-tête Authorization depuis AuthService", () => {
      mockAuth.setToken('bearer_test');
      service.updateCandidateStatus(1, 'INTERVIEW').subscribe();
      const req = httpMock.expectOne(r => r.url === `${API}/1/status`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer bearer_test');
      req.flush({});
    });
  });

  // ── getValidatedCandidates ────────────────────
  describe('getValidatedCandidates()', () => {
    it('appelle GET /api/candidates/validated', () => {
      mockAuth.setToken('manager_token');
      service.getValidatedCandidates().subscribe();
      const req = httpMock.expectOne(`${API}/validated`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('envoie le header Authorization pour /validated', () => {
      mockAuth.setToken('tok_manager');
      service.getValidatedCandidates().subscribe();
      const req = httpMock.expectOne(`${API}/validated`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer tok_manager');
      req.flush([]);
    });

    it('retourne les candidats reçus', () => {
      mockAuth.setToken('tok');
      const fakeData = [{ id: 1, status: 'CV_REVIEWED' }, { id: 2, status: 'INTERVIEW' }];
      let result: any;
      service.getValidatedCandidates().subscribe(data => result = data);
      httpMock.expectOne(`${API}/validated`).flush(fakeData);
      expect(result.length).toBe(2);
      expect(result[0].status).toBe('CV_REVIEWED');
    });
  });

  // ── getCandidatesByEmail ──────────────────────
  describe('getCandidatesByEmail()', () => {
    it('appelle GET /api/candidates/by-email/test@mail.com', () => {
      mockAuth.setToken('tok');
      service.getCandidatesByEmail('test@mail.com').subscribe();
      const req = httpMock.expectOne(`${API}/by-email/test@mail.com`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ── deleteCandidate ───────────────────────────
  describe('deleteCandidate()', () => {
    it('appelle DELETE /api/candidates/7', () => {
      mockAuth.setToken('tok_admin');
      service.deleteCandidate(7).subscribe();
      const req = httpMock.expectOne(`${API}/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });

  // ── createCandidate (apply) ───────────────────
  describe('createCandidate()', () => {
    it('appelle POST /api/candidates/apply avec token si connecté', () => {
      mockAuth.setToken('user_token');
      service.createCandidate({ firstName: 'Ali' }).subscribe();
      const req = httpMock.expectOne(`${API}/apply`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer user_token');
      req.flush({ id: 1 });
    });

    it('appelle POST /api/candidates/apply sans Authorization si non connecté', () => {
      // token null → pas authentifié
      service.createCandidate({ firstName: 'Anon' }).subscribe();
      const req = httpMock.expectOne(`${API}/apply`);
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({ id: 2 });
    });
  });
});
