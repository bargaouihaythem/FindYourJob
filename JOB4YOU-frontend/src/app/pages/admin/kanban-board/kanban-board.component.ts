import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CandidateService } from '../../../services/candidate.service';
import { AuthService } from '../../../services/auth';
import { Candidate } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

/** Libellés exacts des 13 statuts — même vocabulaire que la liste des candidats. */
const STATUTS_LABELS: Record<string, string> = {
  APPLIED: 'Candidature reçue',
  CV_REVIEWED: 'CV validé',
  PHONE_SCREENING: 'Pré-sélection téléphonique',
  TECHNICAL_TEST: 'Test technique',
  INTERVIEW: 'Entretien',
  FINAL_INTERVIEW: 'Entretien final',
  ACCEPTED: 'Avis favorable — contreseing RH attendu',
  INTERVIEW_SCHEDULED: 'Convocation envoyée',
  HIRED: 'Embauché',
  REJECTED: 'Refusé par le RH',
  AUTO_REJECTED: 'Rejeté par l’IA',
  MANAGER_REJECTED: 'Refus proposé — contreseing RH attendu',
  WITHDRAWN: 'Candidature retirée'
};

/** Statuts d'où l'on sort un dossier refusé, et étapes de pipeline où le ramener. */
const STATUTS_APRES_REFUS: Candidate['status'][] = ['AUTO_REJECTED', 'MANAGER_REJECTED'];
const ETAPES_PIPELINE: Candidate['status'][] = [
  'CV_REVIEWED', 'PHONE_SCREENING', 'TECHNICAL_TEST', 'INTERVIEW', 'FINAL_INTERVIEW',
  'ACCEPTED', 'INTERVIEW_SCHEDULED'
];

interface KanbanColumn {
  status: Candidate['status'];
  label: string;
  note?: string;
  /** Statuts réellement regroupés dans cette colonne (carte affichée avec son étiquette exacte). */
  regroupe?: Candidate['status'][];
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

    const definitions: Omit<KanbanColumn, 'candidates'>[] = [
      { status: 'APPLIED', label: 'Candidatures reçues' },
      { status: 'CV_REVIEWED', label: 'CV validé' },
      { status: 'PHONE_SCREENING', label: 'Pré-sélection tél.' },
      { status: 'TECHNICAL_TEST', label: 'Test technique' },
      { status: 'INTERVIEW', label: 'Entretien' },
      { status: 'FINAL_INTERVIEW', label: 'Entretien final' },
      // ACCEPTED n'est pas l'embauche : c'est l'avis favorable, en attente du contreseing RH.
      // Sans cette précision, une carte « Accepté » avec un score de 30/100 passait pour un bug.
      {
        status: 'ACCEPTED', label: 'Accepté — contreseing RH', regroupe: ['ACCEPTED', 'INTERVIEW_SCHEDULED'],
        note: 'Avis favorable enregistré ; la décision finale appartient au RH.'
      },
      { status: 'HIRED', label: 'Embauché', note: 'Décision finale validée par le RH — dossier clos, plus aucun glissement possible.' },
      {
        status: 'REJECTED', label: 'Refusé / clos', regroupe: ['REJECTED', 'AUTO_REJECTED', 'MANAGER_REJECTED', 'WITHDRAWN'],
        note: 'Refus du RH, refus proposé par le manager, rejet de l’IA ou candidature retirée.'
      }
    ];
    // Toute valeur de CandidateStatus doit avoir une colonne : une carte sans colonne
    // disparaît du pipeline et le RH croit à une perte de données.
    const couvertes = definitions.flatMap(d => [d.status, ...(d.regroupe || [])]);
    const oublies = Object.keys(STATUTS_LABELS).filter((s) => !couvertes.includes(s as Candidate['status']));
    if (oublies.length) console.error('Statuts sans colonne kanban :', oublies.join(', '));

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

    for (const candidate of candidates) {
      const colonne = this.colonneDe(candidate.status);
      if (colonne) {
        colonne.candidates.push(candidate);
      } else {
        // Jamais de carte invisible : un statut non apparié est signalé et rangé dans la
        // colonne de son préfixe le plus proche plutôt que disparaître du pipeline.
        console.error(`Kanban : statut « ${candidate.status} » sans colonne (candidat ${candidate.id})`);
      }
    }
  }

  /** Colonne d'affichage d'un statut : les colonnes groupées déclarent leurs membres. */
  private colonneDe(status: Candidate['status']): KanbanColumn | undefined {
    return this.columns.find(col => col.status === status || (col.regroupe || []).includes(status));
  }

  /** Le libellé exact du dossier, quand la colonne en regroupe plusieurs. */
  statutLabel(candidate: Candidate): string {
    return STATUTS_LABELS[candidate.status] || candidate.status;
  }

  /** Une colonne regroupée doit dire de quelle nature est la carte (retrait ≠ refus du RH). */
  afficheStatutExact(candidate: Candidate): boolean {
    return !!this.colonneDe(candidate.status)?.regroupe && candidate.status !== this.colonneDe(candidate.status)!.status;
  }

  /** Score de décision : un score corrigé par le RH prime sur le score de l'IA. */
  scoreRetenu(candidate: Candidate): number | undefined {
    return candidate.manualScore ?? candidate.aiScore ?? undefined;
  }

  scoreTitre(candidate: Candidate): string {
    const ia = candidate.aiScore === undefined || candidate.aiScore === null ? 'non scoré' : `IA ${candidate.aiScore}/100`;
    const corrige = candidate.manualScore !== undefined && candidate.manualScore !== null
      ? ` — corrigé à ${candidate.manualScore}/100 par ${candidate.manualScoreBy || 'le RH'}`
      : '';
    const arbitrage = candidate.humanReviewReason ? ` — ${candidate.humanReviewReason}` : '';
    return `Score ${ia}${corrige}${arbitrage}`;
  }

  /** Dossier tranché : plus aucun glissement possible, la machine à états le refuse. */
  estGlissementInterdit(candidate: Candidate): boolean {
    return candidate.status === 'HIRED' || candidate.status === 'WITHDRAWN';
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

    // Un candidat qui a retiré sa candidature (WITHDRAWN) est affiché dans la même
    // colonne visuelle "Refusé" que REJECTED/AUTO_REJECTED/MANAGER_REJECTED, mais ce
    // n'est pas un refus : on évite de le requalifier silencieusement en refus manager.
    if (targetColumn.status === 'REJECTED' && candidate.status === 'WITHDRAWN') {
      this.toastrNotification.showWarning(
        `${candidate.firstName} ${candidate.lastName} a retiré sa candidature — ce statut n'est pas modifiable ici`
      );
      return;
    }

    const isFinalDecision = targetColumn.status === 'ACCEPTED' || targetColumn.status === 'REJECTED';
    let decisionReason: string | undefined;
    if (targetColumn.status === 'REJECTED') {
      decisionReason = window.prompt('Motif obligatoire du rejet :')?.trim();
      if (!decisionReason) {
        this.toastrNotification.showWarning('Le motif du rejet est obligatoire');
        return;
      }
    }

    // Ramener une carte refusée dans le pipeline est le seul glissement qui rouvre un
    // dossier : le backend en demande le motif, l'e-mail de refus étant déjà parti.
    let rouvertureMotif: string | undefined;
    if (!isFinalDecision
        && STATUTS_APRES_REFUS.includes(candidate.status)
        && ETAPES_PIPELINE.includes(targetColumn.status)) {
      rouvertureMotif = window.prompt(
        'Motif obligatoire : pourquoi cet avis de refus est-il levé ?')?.trim();
      if (!rouvertureMotif) {
        this.toastrNotification.showWarning('Rouvrir un dossier refusé exige un motif');
        return;
      }
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // Accepter/Refuser passe par le même endpoint dédié que les boutons manager
    // (vérifie que le dossier est déjà validé par RH avant d'appliquer la décision) —
    // le endpoint générique de statut ne fait pas cette vérification et permettrait
    // de glisser une candidature directement de "Reçue" à "Accepté" sans validation.
    const request$ = isFinalDecision
      ? this.candidateService.managerDecision(candidate.id, targetColumn.status as 'ACCEPTED' | 'REJECTED', decisionReason)
      : this.candidateService.updateCandidateStatus(candidate.id, targetColumn.status, rouvertureMotif);

    request$.subscribe({
      next: (updated: Candidate) => {
        candidate.status = updated.status;
        this.toastrNotification.showSuccess(`${candidate.firstName} ${candidate.lastName} → ${targetColumn.label}`);
      },
      error: (error: any) => {
        console.error('Erreur lors du changement de statut:', error);
        const message = error?.error?.message || 'Erreur lors du changement de statut, la carte est remise en place';
        this.toastrNotification.showError(message);
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
