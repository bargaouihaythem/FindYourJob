import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InterviewService } from '../../../services/interview.service';
import { CandidateService } from '../../../services/candidate.service';
import { AuthService } from '../../../services/auth';
import { Interview, Candidate } from '../../../models/interfaces';

@Component({
  selector: 'app-my-interviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './my-interviews.component.html',
  styleUrls: ['./my-interviews.component.scss']
})
export class MyInterviewsComponent implements OnInit {
  interviews: Interview[] = [];
  loading = false;
  error: string | null = null;
  currentUser: any = null;
  candidateId: number | null = null;

  constructor(
    private interviewService: InterviewService,
    private candidateService: CandidateService,
    private authService: AuthService
  ) {}
  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMyInterviews();
  }

  loadMyInterviews() {
    console.log('[DEBUG] Current user:', this.currentUser);
    
    if (!this.currentUser?.email) {
      this.error = 'Utilisateur non connecté';
      return;
    }

    console.log('[DEBUG] Chargement des entretiens pour l\'email:', this.currentUser.email);
    this.loading = true;
    this.error = null;

    // Utiliser directement l'endpoint pour récupérer les entretiens par email
    this.interviewService.getInterviewsByEmail(this.currentUser.email).subscribe({
      next: (interviews: Interview[]) => {
        console.log('[DEBUG] Entretiens reçus:', interviews);
        this.interviews = interviews;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des entretiens:', error);
        this.error = 'Erreur lors du chargement des entretiens';
        this.loading = false;
      }    });
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'Planifié';
      case 'IN_PROGRESS': return 'En cours';
      case 'COMPLETED': return 'Terminé';
      case 'CANCELLED': return 'Annulé';
      case 'RESCHEDULED': return 'Reprogrammé';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'badge bg-warning';
      case 'IN_PROGRESS': return 'badge bg-primary';
      case 'COMPLETED': return 'badge bg-success';
      case 'CANCELLED': return 'badge bg-danger';
      case 'RESCHEDULED': return 'badge bg-info';
      default: return 'badge bg-secondary';
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'PHONE_SCREENING': return 'Entretien téléphonique';
      case 'TECHNICAL': return 'Entretien technique';
      case 'HR': return 'Entretien RH';
      case 'MANAGER': return 'Entretien manager';
      case 'FINAL': return 'Entretien final';
      case 'GROUP': return 'Entretien de groupe';
      default: return type || 'Non défini';
    }
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR');
  }

  formatTime(date: Date | string): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
