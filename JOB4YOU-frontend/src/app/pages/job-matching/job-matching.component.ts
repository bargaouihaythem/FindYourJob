import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatchingService } from '../../services/matching.service';
import { JobMatch } from '../../models/interfaces';

@Component({
  selector: 'app-job-matching',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './job-matching.component.html',
  styleUrl: './job-matching.component.scss'
})
export class JobMatchingComponent {
  selectedFile: File | null = null;
  matches: JobMatch[] = [];
  loading = false;
  error: string | null = null;
  searched = false;

  constructor(private matchingService: MatchingService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.error = null;
  }

  findMatches(): void {
    if (!this.selectedFile) {
      this.error = 'Veuillez sélectionner un fichier CV (PDF, DOC ou DOCX)';
      return;
    }

    this.loading = true;
    this.error = null;
    this.searched = true;

    this.matchingService.suggestOffers(this.selectedFile).subscribe({
      next: (matches: JobMatch[]) => {
        this.matches = matches;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'analyse du CV:', error);
        this.error = error?.error?.message || 'Erreur lors de l\'analyse du CV';
        this.loading = false;
      }
    });
  }

  getScoreBarClass(score: number): string {
    if (score >= 70) return 'bg-success';
    if (score >= 40) return 'bg-warning';
    return 'bg-danger';
  }
}
