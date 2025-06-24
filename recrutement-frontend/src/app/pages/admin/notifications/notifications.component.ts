import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService, EmailHistory } from '../../../services/notification.service';
import { CandidateService } from '../../../services/candidate.service';
import { EmailComposerComponent } from '../../../components/email/email-composer.component';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, EmailComposerComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  emailHistory: EmailHistory[] = [];
  candidates: any[] = [];
  loading = true;
  error: string | null = null;
  
  // Filtres
  selectedCandidate = '';
  selectedStatus = '';
  selectedType = '';
  
  // Modal
  showEmailModal = false;
  selectedCandidateForEmail: any = null;

  constructor(
    private notificationService: NotificationService,
    private candidateService: CandidateService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadEmailHistory();
    this.loadCandidates();
  }

  loadEmailHistory(): void {
    this.loading = true;
    this.error = null;
    
    this.notificationService.getEmailHistory().subscribe({
      next: (history) => {
        this.emailHistory = history;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'historique des emails:', error);
        this.error = 'Erreur lors du chargement de l\'historique des emails';
        this.loading = false;
      }
    });
  }

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (candidates: any[]) => {
        this.candidates = candidates;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    });
  }

  getFilteredHistory(): EmailHistory[] {
    return this.emailHistory.filter(email => {
      const matchesCandidate = !this.selectedCandidate || 
        email.to.includes(this.selectedCandidate);
      const matchesStatus = !this.selectedStatus || 
        email.status === this.selectedStatus;
      const matchesType = !this.selectedType || 
        email.type === this.selectedType;
      
      return matchesCandidate && matchesStatus && matchesType;
    });
  }

  openEmailModal(candidate?: any): void {
    this.selectedCandidateForEmail = candidate;
    this.showEmailModal = true;
  }

  closeEmailModal(): void {
    this.showEmailModal = false;
    this.selectedCandidateForEmail = null;
  }

  onEmailSent(): void {
    this.loadEmailHistory();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SENT': return 'badge bg-success';
      case 'FAILED': return 'badge bg-danger';
      case 'PENDING': return 'badge bg-warning';
      default: return 'badge bg-secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'SENT': return 'Envoyé';
      case 'FAILED': return 'Échec';
      case 'PENDING': return 'En attente';
      default: return status;
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'APPLICATION_CONFIRMATION': return 'Confirmation candidature';
      case 'INTERVIEW_INVITATION': return 'Invitation entretien';
      case 'FEEDBACK_NOTIFICATION': return 'Notification feedback';
      case 'CUSTOM': return 'Email personnalisé';
      default: return type;
    }
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'APPLICATION_CONFIRMATION': return 'badge bg-info';
      case 'INTERVIEW_INVITATION': return 'badge bg-primary';
      case 'FEEDBACK_NOTIFICATION': return 'badge bg-warning';
      case 'CUSTOM': return 'badge bg-secondary';
      default: return 'badge bg-light text-dark';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  clearFilters(): void {
    this.selectedCandidate = '';
    this.selectedStatus = '';
    this.selectedType = '';
  }

  refreshHistory(): void {
    this.loadEmailHistory();
  }

  sendApplicationConfirmation(candidateId: number): void {
    this.notificationService.sendApplicationConfirmation(candidateId).subscribe({
      next: () => {
        this.toastr.success('Email de confirmation envoyé avec succès !');
        this.loadEmailHistory();
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de l\'email de confirmation:', error);
        this.toastr.error('Erreur lors de l\'envoi de l\'email de confirmation');
      }
    });
  }

  sendInterviewInvitation(interviewId: number): void {
    this.notificationService.sendInterviewInvitation(interviewId).subscribe({
      next: () => {
        this.toastr.success('Invitation à l\'entretien envoyée avec succès !');
        this.loadEmailHistory();
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de l\'invitation:', error);
        this.toastr.error('Erreur lors de l\'envoi de l\'invitation');
      }
    });
  }

  sendFeedbackNotification(feedbackId: number): void {
    this.notificationService.sendFeedbackNotification(feedbackId).subscribe({
      next: () => {
        this.toastr.success('Notification de feedback envoyée avec succès !');
        this.loadEmailHistory();
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de la notification de feedback:', error);
        this.toastr.error('Erreur lors de l\'envoi de la notification de feedback');
      }
    });
  }
}

