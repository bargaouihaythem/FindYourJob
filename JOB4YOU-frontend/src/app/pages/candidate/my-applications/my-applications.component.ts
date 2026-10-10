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
      case 'INTERVIEW_SCHEDULED': return 'Entretien planifié';
      case 'HIRED': return 'Embauché';
      case 'REJECTED': return 'Rejeté';
      case 'AUTO_REJECTED': return 'Rejeté (analyse IA)';
      case 'MANAGER_REJECTED': return 'Rejeté (manager)';
      case 'WITHDRAWN': return 'Candidature retirée';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'APPLIED': return 'badge bg-primary text-white';
      case 'CV_REVIEWED': return 'badge bg-info text-dark';
      case 'PHONE_SCREENING': return 'badge bg-warning text-dark';
      case 'TECHNICAL_TEST': return 'badge bg-secondary text-white';
      case 'INTERVIEW': 
      case 'FINAL_INTERVIEW':
      case 'INTERVIEW_SCHEDULED': return 'badge bg-info text-white';
      case 'ACCEPTED':
      case 'HIRED': return 'badge bg-success text-white';
      case 'REJECTED':
      case 'AUTO_REJECTED':
      case 'MANAGER_REJECTED': return 'badge bg-danger text-white';
      case 'WITHDRAWN': return 'badge bg-dark text-white';
      default: return 'badge bg-secondary text-white';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'APPLIED': return 'fas fa-paper-plane me-1';
      case 'CV_REVIEWED': return 'fas fa-file-alt me-1';
      case 'PHONE_SCREENING': return 'fas fa-phone me-1';
      case 'TECHNICAL_TEST': return 'fas fa-laptop-code me-1';
      case 'INTERVIEW':
      case 'FINAL_INTERVIEW':
      case 'INTERVIEW_SCHEDULED': return 'fas fa-calendar-check me-1';
      case 'ACCEPTED':
      case 'HIRED': return 'fas fa-check-circle me-1';
      case 'REJECTED':
      case 'AUTO_REJECTED':
      case 'MANAGER_REJECTED': return 'fas fa-times-circle me-1';
      case 'WITHDRAWN': return 'fas fa-ban me-1';
      default: return 'fas fa-info-circle me-1';
    }
  }

  get totalApplicationsCount(): number {
    return this.applications.length;
  }

  get activeApplicationsCount(): number {
    return this.applications.filter(a => !['HIRED', 'WITHDRAWN', 'REJECTED', 'AUTO_REJECTED', 'MANAGER_REJECTED'].includes(a.status)).length;
  }

  get acceptedApplicationsCount(): number {
    return this.applications.filter(a => ['ACCEPTED', 'HIRED'].includes(a.status)).length;
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // Modal de retrait de candidature
  showWithdrawModal = false;
  selectedApplicationToWithdraw: Candidate | null = null;
  withdrawReason = '';
  isWithdrawing = false;

  canWithdraw(application: Candidate): boolean {
    return !['HIRED', 'WITHDRAWN', 'MANAGER_REJECTED', 'AUTO_REJECTED'].includes(application.status);
  }

  openWithdrawModal(application: Candidate): void {
    if (!this.canWithdraw(application)) return;
    this.selectedApplicationToWithdraw = application;
    this.withdrawReason = '';
    this.isWithdrawing = false;
    this.showWithdrawModal = true;
  }

  closeWithdrawModal(): void {
    this.showWithdrawModal = false;
    this.selectedApplicationToWithdraw = null;
    this.withdrawReason = '';
    this.isWithdrawing = false;
  }

  confirmWithdraw(): void {
    if (!this.selectedApplicationToWithdraw) return;
    this.isWithdrawing = true;
    const appId = this.selectedApplicationToWithdraw.id;
    const reason = this.withdrawReason?.trim() || undefined;

    this.candidateService.withdrawApplication(appId, reason).subscribe({
      next: (updated) => {
        const index = this.applications.findIndex(item => item.id === appId);
        if (index >= 0) this.applications[index] = updated;
        this.toastrNotification.showSuccess('Votre candidature a bien été retirée avec succès.', 'Retrait confirmé');
        this.closeWithdrawModal();
      },
      error: (error: any) => {
        const message = error?.error?.message || 'Une erreur est survenue lors du retrait de votre candidature.';
        this.toastrNotification.showError(message, 'Erreur de suppression');
        this.isWithdrawing = false;
      }
    });
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
