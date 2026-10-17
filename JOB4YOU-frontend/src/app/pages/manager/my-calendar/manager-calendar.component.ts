import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Interview } from '../../../models/interfaces';
import { InterviewService } from '../../../services/interview.service';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  interviews: Interview[];
}

@Component({
  selector: 'app-manager-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './manager-calendar.component.html',
  styleUrls: ['./manager-calendar.component.scss']
})
export class ManagerCalendarComponent implements OnInit {
  readonly weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  calendarDate = new Date();
  calendarDays: CalendarDay[] = [];
  upcomingInterviews: Interview[] = [];
  pastInterviews: Interview[] = [];
  loading = true;
  error: string | null = null;
  showDetailModal = false;
  selectedInterview: Interview | null = null;

  constructor(
    private interviewService: InterviewService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.loadCalendar();
  }

  get monthLabel(): string {
    return this.calendarDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    });
  }

  previousMonth(): void {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() - 1, 1);
    this.loadCalendar();
  }

  nextMonth(): void {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 1);
    this.loadCalendar();
  }

  goToToday(): void {
    this.calendarDate = new Date();
    this.loadCalendar();
  }

  loadCalendar(): void {
    this.loading = true;
    this.error = null;

    const start = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 0, 23, 59, 59, 999);

    this.interviewService.getManagerCalendar(this.toLocalIso(start), this.toLocalIso(end)).subscribe({
      next: (interviews: Interview[]) => {
        const sorted = [...interviews].sort((left, right) =>
          new Date(left.interviewDate).getTime() - new Date(right.interviewDate).getTime());
        this.upcomingInterviews = sorted
          .filter(interview => this.isActiveInterview(interview) && new Date(interview.interviewDate).getTime() >= Date.now())
          .slice(0, 3);
        // Entretiens déjà passés dans le mois affiche : le manager doit pouvoir revenir
        // sur le dossier pour y enregistrer son avis sans repasser par la liste.
        this.pastInterviews = sorted
          .filter(interview => interview.status !== 'CANCELLED'
            && new Date(interview.interviewDate).getTime() < Date.now())
          .reverse()
          .slice(0, 5);
        this.buildCalendar(sorted);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement du calendrier manager:', error);
        this.error = 'Impossible de charger votre calendrier. Réessayez dans quelques instants.';
        this.calendarDays = [];
        this.upcomingInterviews = [];
        this.pastInterviews = [];
        this.loading = false;
      }
    });
  }

  private buildCalendar(interviews: Interview[]): void {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - ((firstDay.getDay() + 6) % 7));

    this.calendarDays = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      return {
        date,
        inCurrentMonth: date.getMonth() === month,
        interviews: interviews.filter(interview => this.sameDay(new Date(interview.interviewDate), date))
      };
    });
  }

  private sameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  /**
   * Les bornes sont lues côté serveur en LocalDateTime et comparées à des dates stockées en
   * heure locale murale : un toISOString() avec son « Z » décalerait la plage d'une heure et
   * perdrait les entretiens de fin de mois. D'où un horodatage local sans décalage.
   */
  private toLocalIso(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private isActiveInterview(interview: Interview): boolean {
    return ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'].includes(interview.status);
  }

  /** Entretien dont la date est passée : l'avis du manager doit pouvoir y être rattaché. */
  isPast(interview: Interview): boolean {
    return new Date(interview.interviewDate).getTime() < Date.now();
  }

  /**
   * Le serveur renvoie « advicePossible » : le bouton d'avis n'apparaît que si le dossier
   * est encore à trancher. Sinon on affiche l'état réel du dossier plutôt qu'un bouton mort.
   */
  getCandidateStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      APPLIED: 'Dossier encore à valider par le RH',
      CV_REVIEWED: 'CV validé — en attente de transmission au manager',
      PHONE_SCREENING: 'Entretien téléphonique en cours côté RH',
      TECHNICAL_TEST: 'Avis toujours possible depuis la liste des dossiers',
      INTERVIEW: 'Avis toujours possible depuis la liste des dossiers',
      FINAL_INTERVIEW: 'Avis toujours possible depuis la liste des dossiers',
      ACCEPTED: 'Avis favorable déjà enregistré — décision RH attendue',
      MANAGER_REJECTED: 'Refus déjà proposé — décision RH attendue',
      INTERVIEW_SCHEDULED: 'Entretien planifié — décision RH attendue',
      REJECTED: 'Dossier clôturé : refus validé par le RH',
      AUTO_REJECTED: 'Dossier clôturé par l’agent IA',
      HIRED: 'Dossier clôturé : candidat embauché',
      WITHDRAWN: 'Dossier clôturé : candidature retirée'
    };
    return labels[status ?? ''] ?? 'Dossier hors de votre périmètre';
  }

  /** Marque l'entretien comme effectué (agenda seul : le pipeline reste piloté par les statuts). */
  markAsCompleted(interview: Interview): void {
    this.interviewService.updateInterviewStatus(interview.id, 'COMPLETED').subscribe({
      next: (updated: Interview) => {
        interview.status = updated.status;
        if (this.selectedInterview?.id === interview.id) {
          this.selectedInterview = interview;
        }
        this.toastrNotification.showSuccess(
          `Entretien de ${interview.candidateName || 'candidat'} marqué comme effectué. `
          + "L'avis sur le dossier reste à enregistrer depuis la fiche du candidat.",
          'Entretien effectué');
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut de l’entretien:', error);
        this.toastrNotification.showError(
          error?.error?.message || "Impossible de marquer cet entretien comme effectué.", 'Erreur');
      }
    });
  }

  isToday(date: Date): boolean {
    return this.sameDay(date, new Date());
  }

  formatTime(value: Date | string): string {
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(value: Date | string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  getTypeLabel(type: Interview['type']): string {
    const labels: Record<Interview['type'], string> = {
      PHONE_SCREENING: 'Téléphonique',
      TECHNICAL: 'Technique',
      HR: 'RH',
      MANAGER: 'Manager',
      FINAL: 'Final',
      GROUP: 'Groupe'
    };
    return labels[type] ?? type;
  }

  getStatusClass(status: Interview['status']): string {
    const classes: Record<Interview['status'], string> = {
      SCHEDULED: 'badge bg-primary',
      IN_PROGRESS: 'badge bg-warning text-dark',
      COMPLETED: 'badge bg-success',
      CANCELLED: 'badge bg-danger',
      RESCHEDULED: 'badge bg-info text-dark'
    };
    return classes[status] ?? 'badge bg-secondary';
  }

  getStatusLabel(status: Interview['status']): string {
    const labels: Record<Interview['status'], string> = {
      SCHEDULED: 'Planifié',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminé',
      CANCELLED: 'Annulé',
      RESCHEDULED: 'Reprogrammé'
    };
    return labels[status] ?? status;
  }

  reminderLabel(interview: Interview): string | null {
    const milliseconds = new Date(interview.interviewDate).getTime() - Date.now();
    if (milliseconds < 0 || !this.isActiveInterview(interview)) return null;

    const hours = milliseconds / (1000 * 60 * 60);
    if (hours <= 2) return 'Dans moins de 2 h';
    if (hours <= 24) return 'Aujourd’hui';
    if (hours <= 48) return 'Demain';
    return null;
  }

  openInterviewDetail(interview: Interview): void {
    this.selectedInterview = interview;
    this.showDetailModal = true;
  }

  closeInterviewDetail(): void {
    this.showDetailModal = false;
    this.selectedInterview = null;
  }

  @HostListener('document:keydown.escape')
  closeDetailOnEscape(): void {
    if (this.showDetailModal) {
      this.closeInterviewDetail();
    }
  }

  formatDateTime(value: Date | string): string {
    return new Date(value).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  }

  durationLabel(interview: Interview): string {
    return interview.durationMinutes ? `${interview.durationMinutes} minutes` : 'Non renseignée';
  }
}
