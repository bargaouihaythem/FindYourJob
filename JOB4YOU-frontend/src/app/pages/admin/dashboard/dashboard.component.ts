import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { InterviewService } from '../../../services/interview.service';
import { FeedbackService } from '../../../services/feedback.service';
import { ReminderService } from '../../../services/reminder.service';
import { AuditLogService } from '../../../services/audit-log.service';
import { UserService } from '../../../services/user.service';
import { Candidate, JobOffer, Interview, Feedback, Reminder, AuditLog, User } from '../../../models/interfaces';
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
  avgAiScore: number;
  autoRejected: number;
  managerRejected: number;
  interviewScheduled: number;
  hired: number;
  // Répartition du pipeline, utilisée pour le mini graphique de suivi du recrutement
  applied: number;
  cvReviewed: number;
  inProcess: number;
  accepted: number;
  withdrawn: number;
  rejectedTotal: number;
}

/** Libellés d'affichage pour JobOffer.JobFamily (cf. scoring-settings). */
const JOB_FAMILY_LABELS: { [key: string]: string } = {
  CS: 'CS',
  PRODOPS: 'ProdOps',
  RSD: 'RSD',
  OTHER: 'Autre'
};

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
    completedInterviews: 0,
    avgAiScore: 0,
    autoRejected: 0,
    managerRejected: 0,
    interviewScheduled: 0,
    hired: 0,
    applied: 0,
    cvReviewed: 0,
    inProcess: 0,
    accepted: 0,
    withdrawn: 0,
    rejectedTotal: 0
  };

  /**
   * Rejets MANAGER_REJECTED ventilés par QUI a pris la décision, déduit du journal d'audit
   * (performedBy + rôle réel de l'utilisateur), et non plus un simple total agrégé :
   * - managerRejectedByFamily : rejets effectués par un manager, groupés par sa famille de métier réelle (CS/ProdOps/RSD)
   * - hrRejectedCount : rejets effectués par le RH (bouton "Rejeter" de la gestion des candidats)
   */
  managerRejectedByFamily: { family: string; count: number }[] = [];
  managerCausedRejectedCount = 0;
  hrRejectedCount = 0;

  recentActivities: AuditLog[] = [];
  upcomingInterviews: any[] = [];
  pendingFeedbacks: any[] = [];
  todayReminders: Reminder[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private interviewService: InterviewService,
    private feedbackService: FeedbackService,
    private reminderService: ReminderService,
    private auditLogService: AuditLogService,
    private userService: UserService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadTodayReminders();
  }

  loadTodayReminders(): void {
    this.reminderService.getTodayReminders().subscribe({
      next: (reminders: Reminder[]) => this.todayReminders = reminders,
      error: (error: any) => console.error('Erreur lors du chargement des rappels du jour:', error)
    });
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Charger les statistiques
    this.loadStats();

    // Charger les activités récentes (vrai journal d'audit, pas des données fictives)
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

        // Calculer les nouveaux candidats ce mois (basé sur la date de candidature réelle)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        this.stats.newCandidatesThisMonth = candidates.filter((candidate: any) => {
          const candidateDate = new Date(candidate.applicationDate);
          return candidateDate.getMonth() === currentMonth &&
                 candidateDate.getFullYear() === currentYear;
        }).length;

        // Calculer le score IA moyen
        const scored = candidates.filter((c: any) => c.aiScore != null && c.aiScore > 0);
        this.stats.avgAiScore = scored.length > 0
          ? Math.round(scored.reduce((sum: number, c: any) => sum + c.aiScore, 0) / scored.length)
          : 0;

        // Compteurs par statut
        this.stats.autoRejected = candidates.filter((c: any) => c.status === 'AUTO_REJECTED').length;
        this.stats.managerRejected = candidates.filter((c: any) => c.status === 'MANAGER_REJECTED').length;
        this.stats.interviewScheduled = candidates.filter((c: any) => c.status === 'INTERVIEW_SCHEDULED').length;
        this.stats.hired = candidates.filter((c: any) => c.status === 'HIRED').length;

        // Répartition simplifiée du pipeline (pour le mini graphique de suivi)
        this.stats.applied = candidates.filter((c: any) => c.status === 'APPLIED').length;
        this.stats.cvReviewed = candidates.filter((c: any) => c.status === 'CV_REVIEWED').length;
        this.stats.inProcess = candidates.filter((c: any) =>
          ['PHONE_SCREENING', 'TECHNICAL_TEST', 'INTERVIEW', 'FINAL_INTERVIEW'].includes(c.status)
        ).length;
        this.stats.accepted = candidates.filter((c: any) =>
          ['ACCEPTED', 'INTERVIEW_SCHEDULED', 'HIRED'].includes(c.status)
        ).length;
        this.stats.withdrawn = candidates.filter((c: any) => c.status === 'WITHDRAWN').length;
        // Inclut aussi le statut REJECTED générique (hérité, avant la distinction IA/manager)
        // pour que le total du pipeline corresponde bien au nombre total de candidats.
        this.stats.rejectedTotal = candidates.filter((c: any) =>
          ['REJECTED', 'AUTO_REJECTED', 'MANAGER_REJECTED'].includes(c.status)
        ).length;

        // Ventilation RH / manager des rejets, déduite du journal d'audit (qui a réellement cliqué "Rejeter")
        this.loadRejectionBreakdown(candidates.filter((c: any) => c.status === 'MANAGER_REJECTED'));
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

  /**
   * Détermine, pour chaque candidat MANAGER_REJECTED, qui a réellement pris la décision (RH ou manager)
   * en croisant le journal d'audit (performedBy = username de l'auteur du dernier changement de statut
   * vers MANAGER_REJECTED) avec la liste des utilisateurs et leurs rôles réels. Le statut candidat étant
   * partagé entre RH et manager (même bouton "Rejeter" côté RH, même décision côté manager), c'est le
   * seul moyen fiable de distinguer les deux sans changer le modèle de données.
   */
  private loadRejectionBreakdown(managerRejectedCandidates: Candidate[]): void {
    if (managerRejectedCandidates.length === 0) {
      this.managerRejectedByFamily = [];
      this.managerCausedRejectedCount = 0;
      this.hrRejectedCount = 0;
      return;
    }

    forkJoin({
      users: this.userService.getInterviewers(),
      logs: this.auditLogService.getRecent(500)
    }).subscribe({
      next: ({ users, logs }: { users: User[]; logs: AuditLog[] }) => {
        const userByUsername = new Map<string, User>();
        users.forEach(u => userByUsername.set(u.username, u));

        // Dernier auteur connu du passage à MANAGER_REJECTED, par candidat
        const performerByCandidateId = new Map<number, string>();
        logs
          .filter(l => l.entityType === 'CANDIDATE' && l.action === 'STATUS_CHANGE' && l.newValue === 'MANAGER_REJECTED')
          .forEach(l => {
            if (l.performedBy) {
              performerByCandidateId.set(l.entityId, l.performedBy);
            }
          });

        let hrCount = 0;
        const familyCounts: { [key: string]: number } = {};

        for (const c of managerRejectedCandidates) {
          const performer = performerByCandidateId.get(c.id);
          const user = performer ? userByUsername.get(performer) : undefined;
          const isManager = !!user?.roles?.includes('ROLE_MANAGER');
          const isHr = !!user?.roles?.includes('ROLE_HR');

          if (isHr && !isManager) {
            hrCount++;
          } else {
            // Manager, ou origine non résolue (log hors fenêtre, action admin...) : rattaché à la
            // famille de métier réelle du manager si connue, sinon celle de l'offre concernée.
            const key = user?.jobFamily || (c as any).jobFamily || 'OTHER';
            familyCounts[key] = (familyCounts[key] || 0) + 1;
          }
        }

        this.hrRejectedCount = hrCount;
        this.managerRejectedByFamily = Object.keys(familyCounts).map(key => ({
          family: JOB_FAMILY_LABELS[key] || key,
          count: familyCounts[key]
        }));
        this.managerCausedRejectedCount = Object.values(familyCounts).reduce((sum, n) => sum + n, 0);
      },
      error: (error: any) => {
        console.error('Erreur lors du calcul de la ventilation RH/manager des rejets:', error);
      }
    });
  }

  /**
   * Activités récentes = vrai journal d'audit (changements de statut, scoring, planification...),
   * pas des exemples fictifs. Alimenté par le même endpoint que la page "Historique d'audit".
   */
  private loadRecentActivities(): void {
    this.auditLogService.getRecent(6).subscribe({
      next: (logs: AuditLog[]) => {
        this.recentActivities = logs;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des activités récentes:', error);
      }
    });
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

  /** Valide un feedback directement depuis le tableau de bord. */
  approveFeedback(feedback: any): void {
    this.feedbackService.approveFeedback(feedback.id).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Feedback approuvé avec succès !');
        this.loadPendingFeedbacks();
        this.loadStats();
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'approbation du feedback:', error);
        this.toastrNotification.showError('Erreur lors de l\'approbation du feedback');
      }
    });
  }

  /** Rejette un feedback directement depuis le tableau de bord. */
  rejectFeedback(feedback: any): void {
    this.feedbackService.rejectFeedback(feedback.id).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Feedback rejeté.');
        this.loadPendingFeedbacks();
        this.loadStats();
      },
      error: (error: any) => {
        console.error('Erreur lors du rejet du feedback:', error);
        this.toastrNotification.showError('Erreur lors du rejet du feedback');
      }
    });
  }

  getActivityIcon(action: string): string {
    switch (action) {
      case 'STATUS_CHANGE': return 'fas fa-arrow-right-arrow-left';
      case 'SCORE_OVERRIDE': return 'fas fa-robot';
      case 'INTERVIEW_SCHEDULED': return 'fas fa-calendar-check';
      default: return 'fas fa-info-circle';
    }
  }

  getActivityColor(action: string): string {
    switch (action) {
      case 'STATUS_CHANGE': return 'text-primary';
      case 'SCORE_OVERRIDE': return 'text-warning';
      case 'INTERVIEW_SCHEDULED': return 'text-info';
      default: return 'text-secondary';
    }
  }

  getActivityLabel(action: string): string {
    switch (action) {
      case 'STATUS_CHANGE': return 'Changement de statut';
      case 'SCORE_OVERRIDE': return 'Correction du score IA';
      case 'INTERVIEW_SCHEDULED': return 'Entretien planifié';
      default: return action;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      // Statuts génériques utilisés par endroits dans ce composant
      case 'new':
      case 'active':
        return 'badge bg-success';
      case 'scheduled':
      case 'SCHEDULED':
        return 'badge bg-primary';
      case 'IN_PROGRESS':
        return 'badge bg-success';
      case 'pending':
      case 'PENDING':
        return 'badge bg-warning text-dark';
      case 'completed':
      case 'COMPLETED':
        return 'badge bg-secondary';
      case 'CANCELLED':
        return 'badge bg-danger';
      case 'RESCHEDULED':
        return 'badge bg-info text-dark';
      case 'APPROVED':
      case 'SENT':
        return 'badge bg-success';
      case 'REJECTED':
        return 'badge bg-danger';
      case 'ARCHIVED':
        return 'badge bg-secondary';
      default:
        return 'badge bg-light text-dark';
    }
  }

  formatDate(date: Date | string): string {
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
