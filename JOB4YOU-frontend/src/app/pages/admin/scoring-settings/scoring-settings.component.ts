import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScoringProfileService } from '../../../services/scoring-profile.service';
import { ScoringWeightProfile } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

interface EditableProfile extends ScoringWeightProfile {
  // Poids affichés/édités en pourcentage (0-100) pour l'ergonomie, convertis
  // en décimal (0-1) au moment de l'enregistrement.
  technicalPct: number;
  communicationPct: number;
  seniorityPct: number;
  saving?: boolean;
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

  constructor(
    private scoringProfileService: ScoringProfileService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.loadProfiles();
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
}
