import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CandidateService } from '../../../services/candidate.service';
import { CVService } from '../../../services/cv.service';
import { AuthService } from '../../../services/auth';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { Candidate } from '../../../models/interfaces';

@Component({
  selector: 'app-my-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './my-applications.component.html',
  styleUrls: ['./my-applications.component.scss']
})
export class MyApplicationsComponent implements OnInit {
  applications: Candidate[] = [];
  loading = false;
  error: string | null = null;
  currentUser: any = null;

  constructor(
    private candidateService: CandidateService,
    private cvService: CVService,
    private authService: AuthService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMyApplications();
  }

  loadMyApplications() {
    if (!this.currentUser?.email) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    this.loading = true;
    this.error = null;    this.candidateService.getCandidatesByEmail(this.currentUser.email).subscribe({
      next: (response: Candidate[]) => {
        this.applications = response;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidatures:', error);
        this.error = 'Erreur lors du chargement des candidatures';
        this.loading = false;
      }
    });
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'APPLIED': return 'Candidature envoyée';
      case 'CV_REVIEWED': return 'CV examiné';
      case 'PHONE_SCREENING': return 'Pré-qualification téléphonique';
      case 'TECHNICAL_TEST': return 'Test technique';
      case 'INTERVIEW': return 'Entretien';
      case 'FINAL_INTERVIEW': return 'Entretien final';
      case 'ACCEPTED': return 'Accepté';
      case 'REJECTED': return 'Rejeté';
      case 'WITHDRAWN': return 'Candidature retirée';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'APPLIED': return 'badge bg-primary';
      case 'CV_REVIEWED': return 'badge bg-info';
      case 'PHONE_SCREENING': return 'badge bg-warning';
      case 'TECHNICAL_TEST': return 'badge bg-secondary';
      case 'INTERVIEW': return 'badge bg-warning';
      case 'FINAL_INTERVIEW': return 'badge bg-warning';
      case 'ACCEPTED': return 'badge bg-success';
      case 'REJECTED': return 'badge bg-danger';
      case 'WITHDRAWN': return 'badge bg-secondary';
      default: return 'badge bg-secondary';
    }
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR');
  }
  downloadCV(fileUrl: string | undefined): void {
    if (fileUrl) {
      // Utiliser le service CV avec authentification JWT
      this.cvService.downloadFile(fileUrl).subscribe({
        next: (blob: Blob) => {
          // Créer un téléchargement automatique
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Mon_CV.pdf'; // Nom par défaut
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          this.toastrNotification.showSuccess('CV téléchargé avec succès');
        },
        error: (error: any) => {
          console.error('Erreur lors du téléchargement du CV:', error);
          if (error.status === 401) {
            this.toastrNotification.showError('Erreur d\'authentification. Veuillez vous reconnecter.', 'Accès refusé');
          } else if (error.status === 404) {
            this.toastrNotification.showError('Le fichier CV n\'a pas été trouvé', 'Fichier introuvable');
          } else {
            this.toastrNotification.showError('Erreur lors du téléchargement du CV', 'Erreur de téléchargement');
          }
        }
      });
    } else {
      this.toastrNotification.showError('Aucun CV disponible', 'CV non trouvé');
    }
  }
}
