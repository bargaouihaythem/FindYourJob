import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Interview } from '../../../models/interfaces';
import { InterviewService } from '../../../services/interview.service';

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
  loading = true;
  error: string | null = null;

  constructor(private interviewService: InterviewService) {}

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

    this.interviewService.getManagerCalendar(start.toISOString(), end.toISOString()).subscribe({
      next: (interviews: Interview[]) => {
        const sorted = [...interviews].sort((left, right) =>
          new Date(left.interviewDate).getTime() - new Date(right.interviewDate).getTime());
        this.upcomingInterviews = sorted
          .filter(interview => this.isActiveInterview(interview) && new Date(interview.interviewDate).getTime() >= Date.now())
          .slice(0, 3);
        this.buildCalendar(sorted);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement du calendrier manager:', error);
        this.error = 'Impossible de charger votre calendrier. Réessayez dans quelques instants.';
        this.calendarDays = [];
        this.upcomingInterviews = [];
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

  private isActiveInterview(interview: Interview): boolean {
    return ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'].includes(interview.status);
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

  reminderLabel(interview: Interview): string | null {
    const milliseconds = new Date(interview.interviewDate).getTime() - Date.now();
    if (milliseconds < 0 || !this.isActiveInterview(interview)) return null;

    const hours = milliseconds / (1000 * 60 * 60);
    if (hours <= 2) return 'Dans moins de 2 h';
    if (hours <= 24) return 'Aujourd’hui';
    if (hours <= 48) return 'Demain';
    return null;
  }
}
