import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CandidateService } from '../../../services/candidate.service';
import { AuthService } from '../../../services/auth';
import { Candidate } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

interface KanbanColumn {
  status: Candidate['status'];
  label: string;
  candidates: Candidate[];
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss'
})
export class KanbanBoardComponent implements OnInit {
  loading = true;
  error: string | null = null;
  columns: KanbanColumn[] = [];

  constructor(
    private candidateService: CandidateService,
    private authService: AuthService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.initColumns();
    this.loadCandidates();
  }

  private initColumns(): void {
    const isManagerOnly = this.authService.isManager() && !this.authService.isHR() && !this.authService.isAdmin();

    const definitions: { status: Candidate['status']; label: string }[] = [
      { status: 'APPLIED', label: 'Candidatures reçues' },
      { status: 'CV_REVIEWED', label: 'CV validé' },
      { status: 'PHONE_SCREENING', label: 'Pré-sélection tél.' },
      { status: 'TECHNICAL_TEST', label: 'Test technique' },
      { status: 'INTERVIEW', label: 'Entretien' },
      { status: 'ACCEPTED', label: 'Accepté' },
      { status: 'REJECTED', label: 'Refusé' }
    ];

    // Un manager (sans rôle RH/Admin) ne voit pas les dossiers non encore validés par RH
    this.columns = definitions
      .filter(def => !(isManagerOnly && def.status === 'APPLIED'))
      .map(def => ({ ...def, candidates: [] }));
  }

  loadCandidates(): void {
    this.loading = true;
    this.error = null;

    const isManagerOnly = this.authService.isManager() && !this.authService.isHR() && !this.authService.isAdmin();
    const source = isManagerOnly
      ? this.candidateService.getValidatedCandidates()
      : this.candidateService.getCandidates(0, 500);

    source.subscribe({
      next: (candidates: Candidate[]) => {
        this.dispatchCandidates(candidates);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidats:', error);
        this.error = 'Erreur lors du chargement des candidats';
        this.loading = false;
      }
    });
  }

  private dispatchCandidates(candidates: Candidate[]): void {
    this.columns.forEach(col => col.candidates = []);

    const rejectedLike = ['REJECTED', 'AUTO_REJECTED', 'MANAGER_REJECTED', 'WITHDRAWN'];

    for (const candidate of candidates) {
      let targetStatus: Candidate['status'] = candidate.status;
      if (rejectedLike.includes(candidate.status)) {
        targetStatus = 'REJECTED';
      }
      const column = this.columns.find(col => col.status === targetStatus);
      if (column) {
        column.candidates.push(candidate);
      }
    }
  }

  getConnectedLists(): string[] {
    return this.columns.map(col => col.status);
  }

  drop(event: CdkDragDrop<Candidate[]>, targetColumn: KanbanColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const candidate = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.candidateService.updateCandidateStatus(candidate.id, targetColumn.status).subscribe({
      next: (updated: Candidate) => {
        candidate.status = updated.status;
        this.toastrNotification.showSuccess(`${candidate.firstName} ${candidate.lastName} → ${targetColumn.label}`);
      },
      error: (error: any) => {
        console.error('Erreur lors du changement de statut:', error);
        this.toastrNotification.showError('Erreur lors du changement de statut, la carte est remise en place');
        // Rollback visuel si l'appel échoue
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.container.data.indexOf(candidate),
          event.previousIndex
        );
      }
    });
  }

  getAiScoreBadgeClass(score?: number): string {
    if (score === undefined || score === null) return 'bg-secondary';
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-warning text-dark';
    return 'bg-danger';
  }
}
