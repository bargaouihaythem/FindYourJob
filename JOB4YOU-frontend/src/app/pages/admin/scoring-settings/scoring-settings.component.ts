import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScoringProfileService } from '../../../services/scoring-profile.service';
import { GoldSetService } from '../../../services/gold-set.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { AuthService } from '../../../services/auth';
import { JobOffer, ScoringWeightProfile, GoldSetCaseView, GoldSetProfileReport, GoldSetCalibrationReport } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

interface EditableProfile extends ScoringWeightProfile {
  // Poids affichés/édités en pourcentage (0-100) pour l'ergonomie, convertis
  // en décimal (0-1) au moment de l'enregistrement.
  technicalPct: number;
  communicationPct: number;
  seniorityPct: number;
  saving?: boolean;
}

interface GoldRow extends GoldSetProfileReport {
  applying?: boolean;
  resetting?: boolean;
}

const FAMILY_LABELS: Record<string, string> = {
  CS: 'CS (Consultant / Customer Success)',
  PRODOPS: 'ProdOps',
  RSD: 'RSD',
  OTHER: 'Autre'
};

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Junior',
  MID: 'Confirmé',
  SENIOR: 'Senior'
};

@Component({
  selector: 'app-scoring-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scoring-settings.component.html',
  styleUrl: './scoring-settings.component.scss'
})
export class ScoringSettingsComponent implements OnInit {
  profiles: EditableProfile[] = [];
  loading = true;
  error: string | null = null;

  familyLabels = FAMILY_LABELS;
  levelLabels = LEVEL_LABELS;

  // --- atelier d'étalonnage Gold Set ---
  goldRows: GoldRow[] = [];
  goldGlobal: GoldSetProfileReport | null = null;
  goldEvaluatedAt: Date | null = null;
  goldSource: string | null = null;
  goldTier: Record<string, any> | null = null;
  goldLoading = true;
  calibrating = false;
  goldError: string | null = null;
  showCases = false;
  cases: GoldSetCaseView[] = [];
  offers: { label: string, offers: JobOffer[] }[] = [];
  newCase = { caseRef: '', candidateName: 'Anonyme', jobOfferId: null as number | null,
             groundTruth: 'NON_PERTINENT' as 'PERTINENT' | 'NON_PERTINENT', borderline: false };
  caseFile: File | null = null;
  addingCase = false;
  /** Le Gold Set est un atelier RH : le manager n'a rien à y régler. */
  canCalibrate = false;

  constructor(
    private scoringProfileService: ScoringProfileService,
    private goldSetService: GoldSetService,
    private jobOfferService: JobOfferService,
    private authService: AuthService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.canCalibrate = this.authService.isHR() || this.authService.isAdmin();
    this.loadProfiles();
    if (this.canCalibrate) {
      this.loadGoldReport();
      this.loadCases();
    } else {
      this.goldLoading = false;
    }
  }

  loadProfiles(): void {
    this.loading = true;
    this.error = null;
    this.scoringProfileService.getAll().subscribe({
      next: (profiles) => {
        this.profiles = profiles
          .map(p => ({
            ...p,
            technicalPct: Math.round(p.weightTechnical * 100),
            communicationPct: Math.round(p.weightCommunication * 100),
            seniorityPct: Math.round(p.weightSeniority * 100)
          }))
          .sort((a, b) => a.jobFamily.localeCompare(b.jobFamily) || a.seniorityLevel.localeCompare(b.seniorityLevel));
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des profils de scoring:', err);
        this.error = "Impossible de charger les profils de pondération.";
        this.loading = false;
      }
    });
  }

  sumPct(profile: EditableProfile): number {
    return profile.technicalPct + profile.communicationPct + profile.seniorityPct;
  }

  isValid(profile: EditableProfile): boolean {
    return this.sumPct(profile) === 100;
  }

  save(profile: EditableProfile): void {
    if (!this.isValid(profile)) {
      this.toastrNotification.showError('La somme des 3 poids doit être égale à 100%.');
      return;
    }

    profile.saving = true;
    const request = {
      weightTechnical: profile.technicalPct / 100,
      weightCommunication: profile.communicationPct / 100,
      weightSeniority: profile.seniorityPct / 100
    };

    this.scoringProfileService.upsert(profile.jobFamily, profile.seniorityLevel, request).subscribe({
      next: (updated) => {
        profile.updatedBy = updated.updatedBy;
        profile.updatedAt = updated.updatedAt;
        profile.saving = false;
        this.toastrNotification.showSuccess(
          `Pondération enregistrée pour ${this.familyLabels[profile.jobFamily]} / ${this.levelLabels[profile.seniorityLevel]}.`);
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour du profil de scoring:', err);
        profile.saving = false;
        this.toastrNotification.showError("Erreur lors de l'enregistrement de la pondération.");
      }
    });
  }

  // ------------------------------------------------------------- Gold Set

  loadGoldReport(): void {
    this.goldLoading = true;
    this.goldError = null;
    this.goldSetService.report().subscribe({
      next: (report) => this.applyReport(report),
      error: (err) => {
        this.goldError = err?.error?.message
          || "Aucune mesure disponible : le corpus de référence n'a pas encore été rejoué.";
        this.goldLoading = false;
      }
    });
  }

  /** Rejoue les 20 cas dans le circuit de décision (un appel IA par cas) puis remesure tout. */
  calibrate(): void {
    this.calibrating = true;
    this.goldError = null;
    this.goldSetService.calibrate().subscribe({
      next: (report) => {
        this.calibrating = false;
        this.applyReport(report);
        this.loadCases();
        this.toastrNotification.showSuccess(
          `Corpus rejoué : F1 global ${this.fmtRate(report.global.f1)}.`, 'Calibration terminée');
      },
      error: (err) => {
        this.calibrating = false;
        this.goldError = err?.error?.message || "Le rejeu du corpus n'a pas abouti.";
      }
    });
  }

  private applyReport(report: GoldSetCalibrationReport): void {
    this.goldGlobal = report.global;
    this.goldEvaluatedAt = report.evaluatedAt;
    this.goldSource = report.source;
    this.goldTier = report.goldTier;
    this.goldRows = report.byProfile.map(p => ({ ...p, } as GoldRow));
    this.goldLoading = false;
  }

  loadCases(): void {
    this.goldSetService.listCases().subscribe({
      next: (rows) => this.cases = rows,
      error: () => this.cases = []
    });
    this.jobOfferService.getJobOffers(0, 200).subscribe({
      next: (offers) => {
        // Un cas n'a de sens que rattaché à un profil mesurable : famille ET niveau renseignés.
        // Les offres sont groupées par profil : le RH choisit un profil avant de choisir une offre.
        this.offers = Object.entries(
          offers.filter(o => o.jobFamily && o.seniorityLevel && o.status === 'ACTIVE')
            .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
            .reduce((acc, o) => {
              const key = `${this.familyLabels[o.jobFamily!]} / ${this.levelLabels[o.seniorityLevel!]}`;
              (acc[key] = acc[key] || []).push(o);
              return acc;
            }, {} as Record<string, JobOffer[]>))
          .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
          .map(([label, groupOffers]) => ({ label, offers: groupOffers }));
      },
      error: () => this.offers = []
    });
  }

  onCaseFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.caseFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  canSubmitCase(): boolean {
    return !!this.caseFile && !!this.newCase.caseRef.trim() && this.newCase.jobOfferId != null;
  }

  addCase(): void {
    if (!this.canSubmitCase() || !this.caseFile) return;
    this.addingCase = true;
    this.goldSetService.addCase(this.caseFile, this.newCase.caseRef.trim(), this.newCase.candidateName.trim(),
      this.newCase.jobOfferId!, this.newCase.groundTruth, this.newCase.borderline).subscribe({
      next: (saved) => {
        this.addingCase = false;
        this.toastrNotification.showSuccess(
          `Cas ${saved.caseRef} ajouté au corpus : il sera scoringé au prochain rejeu.`, 'Cas enregistré');
        this.caseFile = null;
        this.newCase.caseRef = '';
        this.loadCases();
      },
      error: (err) => {
        this.addingCase = false;
        // Le backend motive le refus (format, profil non calibrable) : c'est cette raison qu'il faut lire.
        this.toastrNotification.showError(err?.error?.message || "Le cas n'a pas pu être enregistré.");
      }
    });
  }

  applyRecommended(row: GoldRow): void {
    if (!row.jobFamily || !row.seniorityLevel) return;
    row.applying = true;
    this.goldSetService.applyThreshold(row.jobFamily, row.seniorityLevel, row.recommendedThreshold).subscribe({
      next: (res) => {
        row.applying = false;
        this.toastrNotification.showSuccess(res.message, 'Seuil appliqué');
        this.loadGoldReport();
        this.scoringProfileService.getAll().subscribe(p => this.profiles = p.map(x => ({
          ...x,
          technicalPct: Math.round(x.weightTechnical * 100),
          communicationPct: Math.round(x.weightCommunication * 100),
          seniorityPct: Math.round(x.weightSeniority * 100)
        })));
      },
      error: (err) => {
        row.applying = false;
        this.toastrNotification.showError(err?.error?.message || "Le seuil a été refusé.");
      }
    });
  }

  resetProfile(row: GoldRow): void {
    if (!row.jobFamily || !row.seniorityLevel) return;
    row.resetting = true;
    this.goldSetService.resetThreshold(row.jobFamily, row.seniorityLevel).subscribe({
      next: (res) => {
        row.resetting = false;
        this.toastrNotification.showSuccess(res.message, 'Seuil rétabli');
        this.loadGoldReport();
      },
      error: (err) => {
        row.resetting = false;
        this.toastrNotification.showError(err?.error?.message || "Le rétablissement n'a pas abouti.");
      }
    });
  }

  /** Un seuil n'est proposé que s'il existe assez de cas de référence derrière lui. */
  isCalibrable(row: GoldRow): boolean {
    return row.referenceCount >= 4;
  }

  /** Déjà à la valeur recommandée : le bouton n'aurait rien à changer. */
  isAlreadyRecommended(row: GoldRow): boolean {
    return row.appliedIsCalibrated && row.appliedThreshold === row.recommendedThreshold;
  }

  profileLabel(row: GoldRow): string {
    return `${this.familyLabels[row.jobFamily!]} / ${this.levelLabels[row.seniorityLevel!]}`;
  }

  fmtRate(value: number | null | undefined): string {
    // Virgule décimale et espace insécable avant le % : l'écran est français.
    return value == null ? '—'
      : `${(value * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  }

  /** Le F1 qui sert de preuve est celui mesuré au seuil réellement en vigueur. */
  f1Class(row: GoldRow): string {
    const f1 = row.f1AtAppliedThreshold ?? row.f1;
    return f1 >= 0.9 ? 'bg-success' : f1 >= 0.75 ? 'bg-warning text-dark' : 'bg-danger';
  }

  /** Barre à partir de laquelle la machine propose l'étoile « Profil Gold ». */
  goldTierBar(): number {
    return this.goldTier?.['barre_appliquee'] ?? 85;
  }

  offsetDate(value: Date | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
}
