import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../../services/audit-log.service';
import { AuditLog } from '../../../models/interfaces';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss'
})
export class AuditLogComponent implements OnInit {
  logs: AuditLog[] = [];
  loading = true;
  error: string | null = null;

  candidateIdFilter: number | null = null;

  currentPage = 1;
  pageSize = 20;

  constructor(private auditLogService: AuditLogService) {}

  ngOnInit(): void {
    this.loadRecent();
  }

  loadRecent(): void {
    this.loading = true;
    this.error = null;
    this.candidateIdFilter = null;
    this.currentPage = 1;

    this.auditLogService.getRecent(200).subscribe({
      next: (logs: AuditLog[]) => {
        this.logs = logs;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement de l\'historique:', error);
        this.error = 'Erreur lors du chargement de l\'historique';
        this.loading = false;
      }
    });
  }

  filterByCandidate(): void {
    if (!this.candidateIdFilter) {
      this.loadRecent();
      return;
    }
    this.loading = true;
    this.error = null;
    this.currentPage = 1;

    this.auditLogService.getCandidateHistory(this.candidateIdFilter).subscribe({
      next: (logs: AuditLog[]) => {
        this.logs = logs;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement de l\'historique:', error);
        this.error = 'Erreur lors du chargement de l\'historique';
        this.loading = false;
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.logs.length / this.pageSize));
  }

  get paginatedLogs(): AuditLog[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.logs.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'STATUS_CHANGE': return 'bg-primary';
      case 'SCORE_OVERRIDE': return 'bg-warning text-dark';
      case 'INTERVIEW_SCHEDULED': return 'bg-info text-dark';
      default: return 'bg-secondary';
    }
  }
}
