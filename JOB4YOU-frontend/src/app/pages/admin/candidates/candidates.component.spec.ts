import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { CandidatesComponent } from './candidates.component';
import { CandidateService } from '../../../services/candidate.service';
import { AuthService } from '../../../services/auth';
import { JobOfferService } from '../../../services/job-offer.service';
import { CVService } from '../../../services/cv.service';
import { NotificationService } from '../../../services/notification.service';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { EmailComposerComponent } from '../../../components/email/email-composer.component';
import { Candidate } from '../../../models/interfaces';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const fakeCandidate = (id: number, status: string): Candidate => ({
  id, firstName: 'Alice', lastName: 'Dupont', email: 'alice@test.com',
  phone: '0600000000', status, applicationDate: new Date().toISOString(),
  jobOfferId: 1, jobOfferTitle: 'Dev Angular', cv: null,
  address: '', linkedinProfile: '', coverLetter: '', interviewsCount: 0, feedbacksCount: 0
} as any);

class MockCandidateService {
  getCandidates      = jasmine.createSpy().and.returnValue(of([]));
  getValidatedCandidates = jasmine.createSpy().and.returnValue(of([]));
  updateCandidateStatus  = jasmine.createSpy().and.returnValue(of({}));
  deleteCandidate    = jasmine.createSpy().and.returnValue(of({}));
}

class MockAuthService {
  private _roles: string[] = [];
  setRoles(roles: string[]) { this._roles = roles; }
  isManager() { return this._roles.includes('ROLE_MANAGER'); }
  isHR()      { return this._roles.includes('ROLE_HR'); }
  isAdmin()   { return this._roles.includes('ROLE_ADMIN'); }
  isAuthenticated() { return true; }
  getAuthHeaders() { return {}; }
}

class MockJobOfferService {
  getJobOffers = jasmine.createSpy().and.returnValue(of([]));
}
class MockCVService {}
class MockNotificationService {}
class MockToastrService {
  success = jasmine.createSpy();
  error   = jasmine.createSpy();
  warning = jasmine.createSpy();
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('CandidatesComponent — Workflow complet', () => {
  let component: CandidatesComponent;
  let fixture: ComponentFixture<CandidatesComponent>;
  let mockAuth: MockAuthService;
  let mockCandidateService: MockCandidateService;
  let mockToastr: MockToastrService;

  async function createComponent(roles: string[] = []) {
    mockAuth = new MockAuthService();
    mockAuth.setRoles(roles);
    mockCandidateService = new MockCandidateService();
    mockToastr = new MockToastrService();

    await TestBed.configureTestingModule({
      imports: [
        CandidatesComponent,
        CommonModule,
        RouterModule.forRoot([]),
        FormsModule,
        ReactiveFormsModule,
        HttpClientTestingModule
      ],
      providers: [
        { provide: CandidateService,           useValue: mockCandidateService },
        { provide: AuthService,                useValue: mockAuth },
        { provide: JobOfferService,            useValue: new MockJobOfferService() },
        { provide: CVService,                  useValue: new MockCVService() },
        { provide: NotificationService,        useValue: new MockNotificationService() },
        { provide: ToastrNotificationService,  useValue: mockToastr }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CandidatesComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 1 : RH — voit tous les candidats
  // ══════════════════════════════════════════════════════════════════

  describe('Workflow RH — gestion des candidatures', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_HR']);
      mockCandidateService.getCandidates.and.returnValue(of([
        fakeCandidate(1, 'APPLIED'),
        fakeCandidate(2, 'APPLIED'),
        fakeCandidate(3, 'CV_REVIEWED')
      ]));
    });

    it('isManagerView = false pour un RH', () => {
      fixture.detectChanges();
      expect(component.isManagerView).toBeFalse();
    });

    it('appelle getCandidates() (tous les candidats) et non getValidatedCandidates()', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(mockCandidateService.getCandidates).toHaveBeenCalled();
      expect(mockCandidateService.getValidatedCandidates).not.toHaveBeenCalled();
    }));

    it('charge 3 candidats dans la liste', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(component.candidates.length).toBe(3);
      expect(component.totalCandidates).toBe(3);
    }));
  });

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 2 : MANAGER — vue lecture seule sur dossiers validés
  // ══════════════════════════════════════════════════════════════════

  describe('Workflow Manager — vue technique', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_MANAGER']);
      mockCandidateService.getValidatedCandidates.and.returnValue(of([
        fakeCandidate(1, 'CV_REVIEWED'),
        fakeCandidate(2, 'INTERVIEW')
      ]));
    });

    it('isManagerView = true pour un Manager pur', () => {
      fixture.detectChanges();
      expect(component.isManagerView).toBeTrue();
    });

    it('appelle getValidatedCandidates() (pas getCandidates())', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(mockCandidateService.getValidatedCandidates).toHaveBeenCalled();
      expect(mockCandidateService.getCandidates).not.toHaveBeenCalled();
    }));

    it('charge uniquement 2 dossiers validés par RH', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(component.candidates.length).toBe(2);
      expect(component.candidates[0].status).toBe('CV_REVIEWED');
      expect(component.candidates[1].status).toBe('INTERVIEW');
    }));

    it('le bouton Nouveau/Modifier/Supprimer est caché en vue manager', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      // Le badge "Vue Manager" doit être présent
      const badge = compiled.querySelector('.badge');
      // En mode manager, les boutons d'action sont absents
      const editBtns = compiled.querySelectorAll('.btn-edit');
      const deleteBtns = compiled.querySelectorAll('.btn-delete');
      expect(editBtns.length).toBe(0);
      expect(deleteBtns.length).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 3 : ADMIN — isManagerView = false car il est aussi admin
  // ══════════════════════════════════════════════════════════════════

  describe('Workflow Admin — supervision globale', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_ADMIN']);
      mockCandidateService.getCandidates.and.returnValue(of([
        fakeCandidate(1, 'APPLIED'),
        fakeCandidate(2, 'REJECTED')
      ]));
    });

    it('isManagerView = false pour un Admin', () => {
      fixture.detectChanges();
      expect(component.isManagerView).toBeFalse();
    });

    it('appelle getCandidates() pour voir tous les candidats', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(mockCandidateService.getCandidates).toHaveBeenCalled();
    }));
  });

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 4 : MANAGER + HR (les deux rôles) → isManagerView = false
  // ══════════════════════════════════════════════════════════════════

  describe('Workflow Manager+RH — isManagerView = false (rôle HR prioritaire)', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_MANAGER', 'ROLE_HR']);
      mockCandidateService.getCandidates.and.returnValue(of([]));
    });

    it('isManagerView = false quand Manager a aussi ROLE_HR', () => {
      fixture.detectChanges();
      // MANAGER + HR → isManager()=true et isHR()=true → isManagerView = false
      expect(component.isManagerView).toBeFalse();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 5 : Erreur de chargement
  // ══════════════════════════════════════════════════════════════════

  describe('Gestion des erreurs de chargement', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_HR']);
      mockCandidateService.getCandidates.and.returnValue(
        throwError(() => new Error('Network error'))
      );
    });

    it('affiche un message d\'erreur si le backend est inaccessible', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(component.error).toBeTruthy();
      expect(component.loading).toBeFalse();
    }));
  });

  // ══════════════════════════════════════════════════════════════════
  // WORKFLOW 6 : Composant créé correctement
  // ══════════════════════════════════════════════════════════════════

  describe('Instanciation du composant', () => {
    beforeEach(async () => {
      await createComponent(['ROLE_HR']);
      mockCandidateService.getCandidates.and.returnValue(of([]));
    });

    it('le composant est créé', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('loading passe à false après chargement', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(component.loading).toBeFalse();
    }));
  });
});
