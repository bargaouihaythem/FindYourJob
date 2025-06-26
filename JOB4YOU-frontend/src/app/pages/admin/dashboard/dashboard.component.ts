import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { InterviewService } from '../../../services/interview.service';
import { FeedbackService } from '../../../services/feedback.service';
import { Candidate, JobOffer, Interview, Feedback } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

interface DashboardStats {
  totalCandidates: number;
  totalJobOffers: number;
  totalInterviews: number;
  pendingFeedbacks: number;
  activeJobOffers: number;
  scheduledInterviews: number;
  newCandidatesThisMonth: number;
  completedInterviews: number;
}

interface RecentActivity {
  id: number;
  type: 'candidate' | 'interview' | 'feedback' | 'job_offer';
  title: string;
  description: string;
  date: Date;
  status?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats = {
    totalCandidates: 0,
    totalJobOffers: 0,
    totalInterviews: 0,
    pendingFeedbacks: 0,
    activeJobOffers: 0,
    scheduledInterviews: 0,
    newCandidatesThisMonth: 0,
    completedInterviews: 0
  };

  recentActivities: RecentActivity[] = [];
  upcomingInterviews: any[] = [];
  pendingFeedbacks: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private interviewService: InterviewService,
    private feedbackService: FeedbackService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Charger les statistiques
    this.loadStats();
    
    // Charger les activités récentes
    this.loadRecentActivities();
    
    // Charger les entretiens à venir
    this.loadUpcomingInterviews();
    
    // Charger les feedbacks en attente
    this.loadPendingFeedbacks();
  }

  private loadStats(): void {
    // Charger le nombre total de candidats
    this.candidateService.getCandidates().subscribe({
      next: (candidates: Candidate[]) => {
        this.stats.totalCandidates = candidates.length;
        
        // Calculer les nouveaux candidats ce mois
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        this.stats.newCandidatesThisMonth = candidates.filter((candidate: any) => {
          const candidateDate = new Date(candidate.createdAt);
          return candidateDate.getMonth() === currentMonth && 
                 candidateDate.getFullYear() === currentYear;
        }).length;
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des candidats');
        console.error('Erreur lors du chargement des candidats:', error);
      }
    });

    // Charger le nombre total d'offres d'emploi
    this.jobOfferService.getJobOffers().subscribe({
      next: (jobOffers: JobOffer[]) => {
        this.stats.totalJobOffers = jobOffers.length;
        this.stats.activeJobOffers = jobOffers.filter((job: any) => job.status === 'ACTIVE').length;
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des offres d\'emploi');
        console.error('Erreur lors du chargement des offres d\'emploi:', error);
      }
    });

    // Charger le nombre total d'entretiens
    this.interviewService.getInterviews().subscribe({
      next: (interviews: Interview[]) => {
        this.stats.totalInterviews = interviews.length;
        this.stats.scheduledInterviews = interviews.filter((interview: any) => 
          interview.status === 'SCHEDULED' || interview.status === 'IN_PROGRESS'
        ).length;
        this.stats.completedInterviews = interviews.filter((interview: any) => 
          interview.status === 'COMPLETED'
        ).length;
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des entretiens');
        console.error('Erreur lors du chargement des entretiens:', error);
      }
    });

    // Charger le nombre de feedbacks en attente
    this.feedbackService.getPendingFeedbacks().subscribe({
      next: (feedbacks: Feedback[]) => {
        this.stats.pendingFeedbacks = feedbacks.length;
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des feedbacks');
        console.error('Erreur lors du chargement des feedbacks:', error);
      }
    });
  }

  private loadRecentActivities(): void {
    // Simuler des activités récentes (à adapter selon vos APIs)
    this.recentActivities = [
      {
        id: 1,
        type: 'candidate',
        title: 'Nouveau candidat',
        description: 'Jean Dupont a postulé pour le poste de Développeur Frontend',
        date: new Date(),
        status: 'new'
      },
      {
        id: 2,
        type: 'interview',
        title: 'Entretien planifié',
        description: 'Entretien avec Marie Martin pour le poste de Designer UX',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'scheduled'
      },
      {
        id: 3,
        type: 'feedback',
        title: 'Feedback reçu',
        description: 'Feedback d\'entretien pour Pierre Durand',
        date: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'pending'
      }
    ];
  }

  private loadUpcomingInterviews(): void {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString();
    const nextWeekStr = nextWeek.toISOString();
    this.interviewService.getInterviewsByDateRange(todayStr, nextWeekStr).subscribe({
      next: (interviews: Interview[]) => {
        this.upcomingInterviews = interviews
          .filter((interview: Interview) => interview.status === 'SCHEDULED' || interview.status === 'IN_PROGRESS')
          .sort((a: Interview, b: Interview) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime())
          .slice(0, 5); // Limiter à 5 entretiens
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des entretiens à venir');
        console.error('Erreur lors du chargement des entretiens à venir:', error);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loadPendingFeedbacks(): void {
    this.feedbackService.getPendingFeedbacks().subscribe({
      next: (feedbacks: Feedback[]) => {
        this.pendingFeedbacks = feedbacks.slice(0, 5); // Limiter à 5 feedbacks
      },
      error: (error: any) => {
        this.toastrNotification.showError('Erreur lors du chargement des feedbacks en attente');
        console.error('Erreur lors du chargement des feedbacks en attente:', error);
      }
    });
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'candidate': return 'fas fa-user-plus';
      case 'interview': return 'fas fa-calendar-check';
      case 'feedback': return 'fas fa-comment-dots';
      case 'job_offer': return 'fas fa-briefcase';
      default: return 'fas fa-info-circle';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'candidate': return 'text-success';
      case 'interview': return 'text-primary';
      case 'feedback': return 'text-warning';
      case 'job_offer': return 'text-info';
      default: return 'text-secondary';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new': return 'badge bg-success';
      case 'scheduled': return 'badge bg-primary';
      case 'pending': return 'badge bg-warning';
      case 'completed': return 'badge bg-secondary';
      case 'active': return 'badge bg-success';
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

  refreshDashboard(): void {
    this.loadDashboardData();
  }
}

