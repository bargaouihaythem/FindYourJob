import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { CVService } from '../../../services/cv.service';
import { InterviewService } from '../../../services/interview.service';
import { FeedbackService } from '../../../services/feedback.service';
import { NotificationService, FeedbackNotificationRequest } from '../../../services/notification.service';
import { EmailComposerComponent } from '../../../components/email/email-composer.component';
import { InternalNotesComponent } from '../../../components/internal-notes/internal-notes.component';
import { Candidate, JobOffer, RoutingPreview, RoutingRecipientStatus, RoutingStatus } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, EmailComposerComponent, InternalNotesComponent],
  templateUrl: './candidates.component.html',
  styleUrl: './candidates.component.scss'
})
export class CandidatesComponent implements OnInit, OnDestroy {
  candidates: Candidate[] = [];
  filteredCandidates: Candidate[] = [];
  jobOffers: any[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalCandidates = 0;
  totalPages = 0;
  readonly Math = Math;
  
  // Filters
  searchForm: FormGroup;
  selectedStatus = '';
  selectedJobOffer = '';
  sortBy = 'applicationDate';
  sortOrder = 'desc';
  
  // Modal states
  showCandidateModal = false;
  showDeleteModal = false;
  showEmailModal = false;
  showDetailsModal = false;
  selectedCandidate: Candidate | undefined = undefined;
  candidateForm: FormGroup;

  // Correction manuelle du score IA (RH/Admin)
  showScoreOverrideForm = false;
  scoreOverrideForm: FormGroup;
  savingScoreOverride = false;
  
  // File upload
  selectedFile: File | null = null;
  
  // Status dropdown management
  openStatusDropdownId: number | null = null;

  /** Dossier à ouvrir automatiquement après le chargement (lien profond du calendrier manager). */
  private pendingCandidateDetailId: number | null = null;

  /**
   * Aperçu du routage (GET /candidates/{id}/routing-preview) : destinataires réels
   * du dossier si le RH confirme la transmission. Vidé à chaque rechargement de la
   * liste, sinon un ancien aperçu afficherait une destination périmée.
   */
  private routingPreviews: Record<number, RoutingPreview> = {};
  routingPreviewLoading: number | null = null;

  /**
   * Trace de la transmission dans la fiche RH (GET /candidates/{id}/routing-status) :
   * destinataires figés + état de notification de chacun dans l'outbox n8n.
   */
  routingStatus: RoutingStatus | null = null;
  routingStatusLoading = false;
  rerouting = false;

  // Email dropdown management
  openEmailDropdownId: number | null = null;

  // Visibilité de la liste : par défaut seuls les dossiers actifs (non clôturés) sont affichés.
  // 'rejected'  → uniquement REJECTED/AUTO_REJECTED
  // 'withdrawn' → uniquement WITHDRAWN (candidatures retirées, distinctes des rejets)
  // 'hired'     → uniquement HIRED (un candidat embauché n'est pas un candidat rejeté !)
  // 'awaiting'  → dossiers portant un avis manager en attente du contreseing RH
  visibilityFilter: 'active' | 'rejected' | 'withdrawn' | 'hired' | 'awaiting' = 'active';

  // Auto-refresh
  private pollSubscription: Subscription | null = null;
  private readonly POLL_INTERVAL_MS = 12_000;
  isRefreshing = false;
  /** Dossier dont la relance d'analyse est en cours (ligne affichée en chargement). */
  recomputingId: number | null = null;

  /** Statut connu de chaque dossier à la dernière synchro : permet de détecter, entre
   *  deux rafraîchissements, les avis enregistrés par un manager sur un autre poste. */
  private lastSeenStatuses = new Map<number, string>();

  // Validation finale de la décision du manager (RH/Admin)
  showFinalValidationModal = false;
  finalValidationCandidate: Candidate | undefined;
  finalValidationDecision: 'HIRED' | 'REJECTED' = 'HIRED';
  finalValidationForm: FormGroup;
  savingFinalValidation = false;

  /**
   * Vue Manager : true si l'utilisateur connecté est MANAGER.
   * Dans ce mode : lecture seule, seuls les dossiers validés par RH sont visibles.
   * Dans ce mode : boutons édition/suppression/statut sont cachés.
   */
  isManagerView = false;

  constructor(
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private cvService: CVService,
    private interviewService: InterviewService,
    private feedbackService: FeedbackService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private toastrNotification: ToastrNotificationService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      jobOffer: ['']
    });
    
    this.candidateForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      linkedinProfile: [''],
      coverLetter: [''],
      status: ['APPLIED'],
      jobOfferId: ['']
    });

    this.scoreOverrideForm = this.fb.group({
      manualScore: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });

    this.finalValidationForm = this.fb.group({
      presentationDate: ['', [Validators.required]],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  ngOnInit(): void {
    this.isManagerView = this.authService.isManager() && !this.authService.isHR() && !this.authService.isAdmin();
    this.readPendingCandidateDetailParam();
    this.loadCandidates();
    this.loadJobOffers();
    this.setupSearchSubscription();
    this.startPolling();
  }

  /**
   * Lien profond (?candidateId=) envoyé par le calendrier du manager depuis un entretien
   * déjà planifié : la fiche du candidat s'ouvre dès que la liste est chargée.
   */
  private readPendingCandidateDetailParam(): void {
    const requested = Number(this.route.snapshot.queryParamMap.get('candidateId'));
    if (!Number.isInteger(requested) || requested <= 0) return;
    this.pendingCandidateDetailId = requested;
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  private openPendingCandidateDetail(): void {
    if (this.pendingCandidateDetailId === null) return;
    const target = this.candidates.find(c => c.id === this.pendingCandidateDetailId);
    this.pendingCandidateDetailId = null;
    if (target) {
      this.viewCandidateDetails(target);
      return;
    }
    this.toastrNotification.showWarning(
      'Ce dossier ne fait pas partie des candidatures qui vous sont transmises.',
      'Dossier introuvable');
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  isHrOrAdmin(): boolean {
    return this.authService.isHR() || this.authService.isAdmin();
  }

  toggleScoreOverrideForm(): void {
    this.showScoreOverrideForm = !this.showScoreOverrideForm;
    if (this.showScoreOverrideForm && this.selectedCandidate) {
      const currentScore = this.selectedCandidate.effectiveScore ?? this.selectedCandidate.aiScore ?? null;
      this.scoreOverrideForm.reset({ manualScore: currentScore, reason: '' });
    }
  }

  submitScoreOverride(): void {
    if (this.scoreOverrideForm.invalid || !this.selectedCandidate) {
      this.scoreOverrideForm.markAllAsTouched();
      return;
    }

    const { manualScore, reason } = this.scoreOverrideForm.value;
    const candidateId = this.selectedCandidate.id;
    this.savingScoreOverride = true;

    this.candidateService.overrideAiScore(candidateId, manualScore, reason).subscribe({
      next: (updated: Candidate) => {
        this.selectedCandidate = { ...this.selectedCandidate, ...updated };
        const index = this.candidates.findIndex(c => c.id === candidateId);
        if (index !== -1) {
          this.candidates[index] = { ...this.candidates[index], ...updated };
          this.applyFilters();
        }
        this.savingScoreOverride = false;
        this.showScoreOverrideForm = false;
        this.toastrNotification.showSuccess('Le score a été corrigé avec succès.', 'Score corrigé');
      },
      error: (error: any) => {
        console.error('Erreur lors de la correction du score IA:', error);
        this.savingScoreOverride = false;
        const message = error?.error?.message || "Erreur lors de la correction du score.";
        this.toastrNotification.showError(message, 'Erreur');
      }
    });
  }

  exportCandidatePdf(candidate: Candidate): void {
    this.candidateService.exportCandidatePdf(candidate.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dossier-candidat-${candidate.lastName}-${candidate.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.toastrNotification.showSuccess('Dossier PDF exporté avec succès');
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'export PDF:', error);
        this.toastrNotification.showError('Erreur lors de l\'export du dossier PDF');
      }
    });
  }

  private startPolling(): void {
    this.pollSubscription = interval(this.POLL_INTERVAL_MS).subscribe(() => {
      this.silentRefresh();
    });
  }

  /** Rafraîchit les données sans afficher le spinner principal */
  silentRefresh(): void {
    this.isRefreshing = true;
    const fetch$ = this.isManagerView
      ? this.candidateService.getValidatedCandidates()
      : this.candidateService.getCandidates();

    fetch$.subscribe({
      next: (candidates: Candidate[]) => {
        if (!this.isManagerView) this.detectManagerDecisions(candidates);
        this.candidates = candidates;
        this.totalCandidates = candidates.length;
        this.totalPages = Math.ceil(this.totalCandidates / this.pageSize);
        this.applyFilters();
        this.rememberStatuses(candidates);
        this.isRefreshing = false;
      },
      error: () => { this.isRefreshing = false; }
    });
  }

  private rememberStatuses(candidates: Candidate[]): void {
    candidates.forEach(c => this.lastSeenStatuses.set(c.id, c.status));
  }

  /**
   * Feedback temps réel côté RH : un manager qui enregistre son avis sur un autre
   * poste n'ouvre pas une page chez le RH. On compare donc le statut de chaque dossier
   * avec celui vu à la synchro précédente et on alerte dès qu'un avis manager apparaît.
   * Les statuts posés par le RH lui-même sont écrits dans le snapshot au moment de
   * son action, ce qui évite qu'il reçoive un toast pour sa propre décision.
   */
  private detectManagerDecisions(candidates: Candidate[]): void {
    candidates.forEach(candidate => {
      const previous = this.lastSeenStatuses.get(candidate.id);
      if (!previous || previous === candidate.status) return;
      const manager = candidate.statusChangedBy || 'Le manager';
      if (candidate.status === 'ACCEPTED') {
        this.toastrNotification.showInfo(
          `${manager} a émis un avis favorable pour ${candidate.firstName} ${candidate.lastName} ` +
          `(${candidate.jobOfferTitle}). En attente de votre validation finale.`,
          'Avis manager — décision finale à valider');
      } else if (candidate.status === 'MANAGER_REJECTED') {
        const reason = candidate.statusReason ? ` Motif : ${candidate.statusReason}` : '';
        this.toastrNotification.showWarning(
          `${manager} propose de refuser ${candidate.firstName} ${candidate.lastName} ` +
          `(${candidate.jobOfferTitle}).${reason}`,
          'Refus proposé par le manager');
      }
    });
  }

  /** Mémorise le statut juste posé par l'utilisateur courant (pour ne pas s'auto-notifier). */
  private rememberStatus(candidateId: number, status: string): void {
    this.lastSeenStatuses.set(candidateId, status);
  }

  loadCandidates(): void {
    this.loading = true;
    this.error = null;

    // MANAGER : voit uniquement les dossiers validés par RH (statut CV_REVIEWED+)
    // RH/ADMIN : voit tous les candidats
    const fetch$ = this.isManagerView
      ? this.candidateService.getValidatedCandidates()
      : this.candidateService.getCandidates();

    fetch$.subscribe({
      next: (candidates: Candidate[]) => {
        this.candidates = candidates;
        this.routingPreviews = {};
        this.totalCandidates = candidates.length;
        this.totalPages = Math.ceil(this.totalCandidates / this.pageSize);
        this.applyFilters();
        this.rememberStatuses(candidates);
        this.loading = false;
        this.openPendingCandidateDetail();
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidats:', error);
        this.error = 'Erreur lors du chargement des candidats';
        this.loading = false;
      }
    });
  }

  loadJobOffers(): void {
    this.jobOfferService.getJobOffers().subscribe({
      next: (jobOffers: JobOffer[]) => {
        this.jobOffers = jobOffers;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des offres d\'emploi:', error);
      }
    });
  }

  setupSearchSubscription(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const { searchTerm, status, jobOffer } = this.searchForm.value;

    this.filteredCandidates = this.candidates.filter(candidate => {
      const matchesSearch = !searchTerm ||
        candidate.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !status || candidate.status === status;
      const matchesJobOffer = !jobOffer || candidate.jobOfferId?.toString() === jobOffer;

      // ACCEPTED et MANAGER_REJECTED sont des avis manager : le dossier reste actif
      // (il attend la validation finale du RH), ce n'est pas un dossier clôturé.
      const isRejectedFamily = candidate.status === 'REJECTED' || candidate.status === 'AUTO_REJECTED';
      const isWithdrawn = candidate.status === 'WITHDRAWN';
      const isHired = candidate.status === 'HIRED';
      const isAwaiting = this.isAwaitingHrValidation(candidate.status);

      let matchesVisibility: boolean;
      if (this.visibilityFilter === 'rejected') {
        matchesVisibility = isRejectedFamily;
      } else if (this.visibilityFilter === 'withdrawn') {
        matchesVisibility = isWithdrawn;
      } else if (this.visibilityFilter === 'hired') {
        matchesVisibility = isHired;
      } else if (this.visibilityFilter === 'awaiting') {
        matchesVisibility = isAwaiting;
      } else {
        matchesVisibility = !isRejectedFamily && !isWithdrawn && !isHired;
      }

      return matchesSearch && matchesStatus && matchesJobOffer && matchesVisibility;
    });

    this.sortCandidates();
    this.updatePagination();
  }

  toggleShowRejected(): void {
    this.visibilityFilter = this.visibilityFilter === 'rejected' ? 'active' : 'rejected';
    this.applyFilters();
  }

  toggleShowWithdrawn(): void {
    this.visibilityFilter = this.visibilityFilter === 'withdrawn' ? 'active' : 'withdrawn';
    this.applyFilters();
  }

  toggleShowHired(): void {
    this.visibilityFilter = this.visibilityFilter === 'hired' ? 'active' : 'hired';
    this.applyFilters();
  }

  toggleShowAwaiting(): void {
    this.visibilityFilter = this.visibilityFilter === 'awaiting' ? 'active' : 'awaiting';
    this.applyFilters();
  }

  getRejectedCount(): number {
    return this.candidates.filter(c =>
      c.status === 'REJECTED' || c.status === 'AUTO_REJECTED'
    ).length;
  }

  /** Dossiers portant un avis manager (favorable ou refus proposé) en attente du contreseing RH. */
  getAwaitingValidationCount(): number {
    return this.candidates.filter(c =>
      c.status === 'ACCEPTED' || c.status === 'MANAGER_REJECTED' || c.status === 'INTERVIEW_SCHEDULED'
    ).length;
  }

  isAwaitingHrValidation(status: string): boolean {
    return status === 'ACCEPTED' || status === 'MANAGER_REJECTED' || status === 'INTERVIEW_SCHEDULED';
  }

  getWithdrawnCount(): number {
    return this.candidates.filter(c => c.status === 'WITHDRAWN').length;
  }

  getHiredCount(): number {
    return this.candidates.filter(c => c.status === 'HIRED').length;
  }

  /** Statuts finaux — plus aucune modification possible.
   *  ACCEPTED / MANAGER_REJECTED / INTERVIEW_SCHEDULED n'en font plus partie : ce sont
   *  des avis en attente du contreseing RH, la liste doit donc rester actionnable.
   *  AUTO_REJECTED non plus : une décision de l'IA reste rouvrable par le RH
   *  (confirmation du refus ou correction du score), l'humain doit pouvoir trancher. */
  isStatusLocked(status: string): boolean {
    return status === 'REJECTED' ||
           status === 'HIRED' || status === 'WITHDRAWN';
  }

  /** Décision prise par l'IA, en attente d'arbitrage humain. */
  isIaDecision(status: string): boolean {
    return status === 'AUTO_REJECTED';
  }

  /**
   * Score affiché en liste : le score effectivement décidé, correction RH comprise.
   * La fiche détail et le classement du serveur (getRankingForJobOffer) retiennent déjà
   * cette valeur ; la liste doit sinon afficher un chiffre périmé après un override.
   */
  listScore(candidate: Candidate): number | null {
    const score = candidate.effectiveScore ?? candidate.aiScore;
    return score && score > 0 ? score : null;
  }

  scoreTitle(candidate: Candidate): string {
    if (candidate.manualScore != null) {
      return `Score retenu ${candidate.manualScore}/100, corrigé par ${candidate.manualScoreBy || 'un RH'}`
        + ` — score IA original : ${candidate.aiScore}/100`;
    }
    return `Score analysé par l'Agent 1 n8n : ${candidate.aiScore}/100`;
  }

  /**
   * Relance de l'analyse possible seulement si la machine à états admet le statut
   * que le recalcul produit (CV_REVIEWED ou AUTO_REJECTED). Proposer le bouton
   * ailleurs reviendrait à afficher un contrôle qui renvoie une erreur 400.
   */
  canRecompute(status: string): boolean {
    return status === 'APPLIED' || status === 'CV_REVIEWED'
      || status === 'AUTO_REJECTED' || status === 'MANAGER_REJECTED';
  }

  recomputeScore(candidate: Candidate): void {
    this.recomputingId = candidate.id;
    this.candidateService.recomputeAiScore(candidate.id).subscribe({
      next: () => {
        this.recomputingId = null;
        this.toastrNotification.showSuccess(
          `Analyse relancée pour ${candidate.firstName} ${candidate.lastName}.`, 'Analyse IA');
        this.silentRefresh();
      },
      error: (err: any) => {
        this.recomputingId = null;
        this.toastrNotification.showError(
          err?.error?.message || "L'analyse n'a pas pu être relancée.", 'Erreur');
      }
    });
  }

  sortCandidates(): void {
    this.filteredCandidates.sort((a, b) => {
      // La colonne « Score IA » trie la valeur réellement affichée, pas le seul score brut.
      let aValue = this.sortBy === 'aiScore' ? this.listScore(a) : a[this.sortBy as keyof Candidate];
      let bValue = this.sortBy === 'aiScore' ? this.listScore(b) : b[this.sortBy as keyof Candidate];
      
      // Gérer les valeurs undefined
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  updatePagination(): void {
    this.totalCandidates = this.filteredCandidates.length;
    this.totalPages = Math.ceil(this.totalCandidates / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  getPaginatedCandidates(): Candidate[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredCandidates.slice(startIndex, endIndex);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.totalPages = Math.ceil(this.filteredCandidates.length / this.pageSize);
  }

  changeSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fas fa-sort';
    return this.sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  // Status dropdown methods
  toggleStatusDropdown(candidateId: number, currentStatus: string): void {
    if (this.isStatusLocked(currentStatus)) return;
    const opening = this.openStatusDropdownId !== candidateId;
    this.openStatusDropdownId = opening ? candidateId : null;
    // Le RH doit savoir où le dossier va avant de confirmer l'aiguillage.
    if (opening && currentStatus === 'PHONE_SCREENING') {
      this.loadRoutingPreview(candidateId);
    }
  }

  loadRoutingPreview(candidateId: number): void {
    if (this.routingPreviews[candidateId]) return;
    this.routingPreviewLoading = candidateId;
    this.candidateService.getRoutingPreview(candidateId).subscribe({
      next: (preview: RoutingPreview) => {
        this.routingPreviews[candidateId] = preview;
        this.routingPreviewLoading = null;
      },
      error: () => {
        // L'aperçu est une aide : son indisponibilité n'empêche pas la transmission,
        // qui reste contrôlée côté serveur.
        this.routingPreviewLoading = null;
      }
    });
  }

  /** Nom lisible des managers destinataires, tel que résolu par le backend. */
  routingHint(candidateId: number): string | null {
    if (this.routingPreviewLoading === candidateId) return 'Destinataires en cours de calcul…';
    const preview = this.routingPreviews[candidateId];
    if (!preview) return null;
    if (!preview.managers || preview.managers.length === 0) {
      return 'Aucun manager destinataire : l\'offre n\'est rattachée à aucun manager.';
    }
    return `Destinataires : ${preview.managers.map(m => m.fullName).join(', ')}`;
  }

  /** Destinataires figés sur le dossier après transmission ; à défaut, l'aperçu. */
  private routedNames(candidate: Candidate, preview?: RoutingPreview): string {
    const frozen = candidate?.routedManagerEmails
      ? candidate.routedManagerEmails.split(',').map(e => e.trim()).filter(e => !!e)
      : [];
    if (frozen.length) {
      const byEmail = new Map((preview?.managers ?? []).map(m => [m.email.toLowerCase(), m.fullName]));
      return frozen.map(email => byEmail.get(email.toLowerCase()) ?? email).join(', ');
    }
    if (candidate?.routedManagerName) return candidate.routedManagerName;
    const names = (preview?.managers ?? []).map(m => m.fullName);
    return names.length ? names.join(', ') : '';
  }

  isStatusDropdownOpen(candidateId: number): boolean {
    return this.openStatusDropdownId === candidateId;
  }

  // Email dropdown methods
  toggleEmailDropdown(candidateId: number): void {
    this.openEmailDropdownId = this.openEmailDropdownId === candidateId ? null : candidateId;
  }

  isEmailDropdownOpen(candidateId: number): boolean {
    return this.openEmailDropdownId === candidateId;
  }

  // View candidate details method
  viewCandidateDetails(candidate: Candidate): void {
    this.selectedCandidate = candidate;
    this.showDetailsModal = true;
    this.showScoreOverrideForm = false;
    this.loadRoutingStatus(candidate.id);
  }

  /**
   * Trace RH de la transmission. La lecture est réservée au RH/Admin (l'endpoint
   * l'est aussi) ; une fiche sans transmission affiche un bloc vide plutôt qu'un
   * faux « envoyé ».
   */
  loadRoutingStatus(candidateId: number): void {
    this.routingStatus = null;
    if (!this.isHrOrAdmin()) return;
    this.routingStatusLoading = true;
    this.candidateService.getRoutingStatus(candidateId).subscribe({
      next: (status: RoutingStatus) => {
        this.routingStatus = status;
        this.routingStatusLoading = false;
      },
      error: () => {
        this.routingStatusLoading = false;
      }
    });
  }

  /** Relance ouverte dès qu'une transmission existe : un envoi en file ou en échec
   *  doit pouvoir être repris sans repasser par la machine à états. */
  get canRerouteNotification(): boolean {
    return this.isHrOrAdmin() && !!this.routingStatus?.transmitted && !this.rerouting;
  }

  rerouteNotification(): void {
    const candidate = this.selectedCandidate;
    if (!candidate || this.rerouting) return;
    this.rerouting = true;
    this.candidateService.rerouteNotification(candidate.id).subscribe({
      next: (status: RoutingStatus) => {
        this.routingStatus = status;
        this.rerouting = false;
        const notified = status.recipients.filter(r => r.notificationStatus !== 'NOT_ENQUEUED');
        if (notified.length === 0) {
          this.toastrNotification.showWarning(
            'Aucune relance envoyée : le webhook Agent 3 n\'est pas configuré côté serveur.',
            'Relance impossible');
        } else {
          this.toastrNotification.showSuccess(
            `Notification relancée pour ${notified.map(r => r.fullName).join(', ')}.`,
            'Relance demandée');
        }
      },
      error: (error: any) => {
        this.rerouting = false;
        this.toastrNotification.showError(
          error?.error?.message || 'Erreur lors de la relance de la notification.',
          'Relance échouée');
      }
    });
  }

  notificationStatusLabel(recipient: RoutingRecipientStatus): string {
    switch (recipient.notificationStatus) {
      case 'SENT': return 'Notifié';
      case 'PENDING': return 'En cours d\'envoi';
      case 'FAILED': return 'Échec d\'envoi';
      default: return 'Aucune notification enregistrée';
    }
  }

  notificationStatusBadge(recipient: RoutingRecipientStatus): string {
    switch (recipient.notificationStatus) {
      case 'SENT': return 'bg-success';
      case 'PENDING': return 'bg-warning text-dark';
      case 'FAILED': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  /** Ligne « transmis à … » sous le dossier, pour que la liste reste lisible sans ouvrir la fiche. */
  transmittedToLabel(candidate: Candidate): string | null {
    const frozen = candidate?.routedManagerEmails
      ? candidate.routedManagerEmails.split(',').map(e => e.trim()).filter(e => !!e)
      : [];
    if (!frozen.length && !candidate?.routedManagerName) return null;
    if (candidate.routedManagerName) {
      const others = frozen.length > 1 ? ` (+${frozen.length - 1} autre destinataire)` : '';
      return `Transmis à ${candidate.routedManagerName}${others}`;
    }
    return `Transmis à ${frozen.join(', ')}`;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCandidate = undefined;
    this.showScoreOverrideForm = false;
    this.routingStatus = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Fermer le dropdown si on clique en dehors
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.openStatusDropdownId = null;
      this.openEmailDropdownId = null;
    }
  }

  openCandidateModal(candidate?: Candidate): void {
    this.selectedCandidate = candidate || undefined;
    
    // Fermer le modal des détails s'il est ouvert
    this.showDetailsModal = false;
    
    if (candidate) {
      this.candidateForm.patchValue({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        address: candidate.address,
        linkedinProfile: candidate.linkedinProfile || '',
        coverLetter: candidate.coverLetter || '',
        status: candidate.status,
        jobOfferId: candidate.jobOfferId || ''
      });
    } else {
      this.candidateForm.reset();
      this.candidateForm.patchValue({ status: 'APPLIED' });
    }
    
    this.showCandidateModal = true;
  }

  closeCandidateModal(): void {
    this.showCandidateModal = false;
    this.selectedCandidate = undefined;
    this.candidateForm.reset();
    this.selectedFile = null;
  }

  uploadCV(candidateId: number): void {
    if (this.selectedFile) {
      this.cvService.uploadCV(candidateId, this.selectedFile).subscribe({
        next: () => {
          this.toastrNotification.showCvUploadSuccess();
          this.loadCandidates(); // Rafraîchir la liste après upload
        },
        error: (error) => {
          console.error('Erreur lors du téléchargement du CV:', error);
          this.toastrNotification.showCvUploadError();
        }
      });
    }
  }

  downloadCV(candidate: Candidate): void {
    if (candidate.cv && candidate.cv.fileUrl) {
      // Utiliser le service CV avec authentification JWT au lieu de window.open()
      this.cvService.downloadFile(candidate.cv.fileUrl).subscribe({
        next: (blob: Blob) => {
          // Créer un URL temporaire pour le blob
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          
          // Déterminer le nom du fichier
          const fileName = candidate.cv?.originalFilename || 
                          `CV_${candidate.firstName}_${candidate.lastName}.pdf`;
          
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          
          // Nettoyer
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
      this.toastrNotification.showError('Aucun CV disponible pour ce candidat', 'CV non trouvé');
    }
  }

  saveCandidate(): void {
    if (this.candidateForm.valid) {
      const candidateData = this.candidateForm.value;
      
      // Nettoyer les données selon le DTO backend
      const cleanData = {
        firstName: candidateData.firstName,
        lastName: candidateData.lastName,
        email: candidateData.email,
        phone: candidateData.phone || null,
        address: candidateData.address || null,
        linkedinProfile: candidateData.linkedinProfile || null,
        coverLetter: candidateData.coverLetter || null,
        status: candidateData.status,
        jobOfferId: Number(candidateData.jobOfferId)
      };
      
      // Vérification finale
      if (!cleanData.jobOfferId || cleanData.jobOfferId === 0) {
        this.toastrNotification.showValidationError("Veuillez sélectionner une offre d'emploi.");
        return;
      }
      
      if (this.selectedCandidate) {
        // Mise à jour
        this.candidateService.updateCandidate(this.selectedCandidate.id, cleanData).subscribe({
          next: () => {
            this.toastrNotification.showCandidateUpdatedSuccess();
            this.loadCandidates();
            this.closeCandidateModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la mise à jour du candidat:', error);
            let errorMessage = 'Erreur lors de la mise à jour du candidat';
            
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.status === 400) {
              errorMessage = 'Données invalides. Vérifiez les champs du formulaire.';
            } else if (error.status === 401) {
              errorMessage = 'Non autorisé. Veuillez vous reconnecter.';
            } else if (error.status === 403) {
              errorMessage = 'Accès refusé. Droits insuffisants.';
            }
            
            this.toastrNotification.showCandidateError(errorMessage);
            this.error = errorMessage;
          }
        });
      } else {
        // Création avec CV (FormData)
        if (this.selectedFile) {
          this.cvService.submitApplication(cleanData, this.selectedFile).subscribe({
            next: () => {
              this.toastrNotification.showCandidateCreatedSuccess();
              this.loadCandidates();
              this.closeCandidateModal();
            },
            error: (error: any) => {
              console.error('Erreur lors de la création du candidat:', error);
              this.toastrNotification.showCandidateError('Erreur lors de la création du candidat');
              this.error = 'Erreur lors de la création du candidat';
            }
          });
        } else {
          this.toastrNotification.showValidationError('Veuillez sélectionner un fichier CV.');
        }
      }
    }
  }

  openDeleteModal(candidate: Candidate): void {
    this.selectedCandidate = candidate;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedCandidate = undefined;
  }

  deleteCandidate(): void {
    if (this.selectedCandidate) {
      this.candidateService.deleteCandidate(this.selectedCandidate.id).subscribe({
          next: () => {
            this.toastrNotification.showCandidateDeletedSuccess();
            this.loadCandidates();
            this.closeDeleteModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la suppression du candidat:', error);
            this.toastrNotification.showCandidateError('Erreur lors de la suppression du candidat');
            this.error = 'Erreur lors de la suppression du candidat';
          }
        });
    }
  }

  updateCandidateStatus(candidate: Candidate, newStatus: string): void {
    const backendStatus = this.mapStatusToBackend(newStatus);
    const preview = this.routingPreviews[candidate.id];
    this.candidateService.updateCandidateStatus(candidate.id, backendStatus).subscribe({
      next: (updated: Candidate) => {
        const t = this.statusChangeToast(backendStatus, updated ?? candidate, preview);
        this.toastrNotification.showSuccess(t.message, t.title);
        Object.assign(candidate, updated ?? {});
        candidate.status = newStatus as Candidate['status'];
        delete this.routingPreviews[candidate.id];
        this.rememberStatus(candidate.id, backendStatus);
        // Réappliquer les filtres pour que la liste se mette à jour immédiatement,
        // sans rechargement de page : un candidat passé en « Candidature retirée »
        // (ou tout statut sortant de la vue active) disparaît aussitôt et le total
        // affiché est décrémenté (ex. 22 → 21).
        this.applyFilters();
        // Fermer les dropdowns après la mise à jour
        this.openStatusDropdownId = null;
        this.openEmailDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        // Le backend refuse une transmission sans manager destinataire et explique
        // comment le corriger : reprendre son message plutôt qu'un texte générique.
        const message = error?.error?.message || 'Erreur lors de la mise à jour du statut';
        this.toastrNotification.showCandidateError(message);
        this.error = message;
        // Fermer les dropdowns même en cas d'erreur
        this.openStatusDropdownId = null;
        this.openEmailDropdownId = null;
      }
    });
  }

  /**
   * Transitions de statut autorisées depuis le statut courant, côté RH/Admin.
   * Reflète la machine à états du chapitre 3 : progression linéaire des étapes
   * d'évaluation, et contreseing des avis managers (ACCEPTED / MANAGER_REJECTED /
   * INTERVIEW_SCHEDULED) via la validation finale.
   * kind : 'status' → updateCandidateStatus ; 'accept'/'reject' → managerDecision ;
   *        'final-hire'/'final-reject' → finalValidation (endpoint dédié RH).
   */
  getAvailableTransitions(status: string): { key: string; label: string; icon: string; kind: 'status' | 'accept' | 'reject' | 'final-hire' | 'final-reject' }[] {
    const step = (key: string, label: string, icon: string) => ({ key, label, icon, kind: 'status' as const });
    const accept = { key: 'ACCEPT', label: 'Émettre un avis favorable', icon: 'fas fa-user-check text-success', kind: 'accept' as const };
    const reject = { key: 'REJECT', label: 'Refuser', icon: 'fas fa-user-times text-danger', kind: 'reject' as const };
    const hire = { key: 'HIRED', label: "Valider l'embauche", icon: 'fas fa-file-signature text-success', kind: 'final-hire' as const };
    const confirmReject = { key: 'REJECTED', label: 'Confirmer le refus', icon: 'fas fa-user-times text-danger', kind: 'final-reject' as const };
    const withdraw = step('WITHDRAWN', 'Candidature retirée', 'fas fa-user-minus text-secondary');
    switch (status) {
      case 'APPLIED':
        return [step('CV_REVIEWED', 'CV examiné', 'fas fa-eye text-info'), withdraw];
      case 'CV_REVIEWED':
        // Pas d'acceptation directe : l'entretien téléphonique RH est une étape obligatoire
        // avant toute embauche. Un CV manifestement mauvais peut en revanche être refusé
        // ou retiré sans attendre cet entretien.
        return [step('PHONE_SCREENING', 'Entretien téléphonique', 'fas fa-phone text-warning'), reject, withdraw];
      case 'PHONE_SCREENING':
        return [step('TECHNICAL_TEST', 'Valider → transmettre au manager (Test technique)', 'fas fa-user-check text-success'), accept, reject, withdraw];
      case 'TECHNICAL_TEST':
        return [step('INTERVIEW', 'Entretien', 'fas fa-comments text-primary'), accept, reject, withdraw];
      case 'INTERVIEW':
        return [step('FINAL_INTERVIEW', 'Entretien final', 'fas fa-handshake text-primary'), accept, reject, withdraw];
      case 'FINAL_INTERVIEW':
        return [accept, reject, withdraw];
      case 'ACCEPTED':
        // Avis favorable du manager : le RH contresigne (embauche) ou tranche en refus.
        return [hire, confirmReject, withdraw];
      case 'MANAGER_REJECTED':
        // Refus proposé par le manager : le RH le confirme ou remet le dossier dans le pipeline.
        return [confirmReject,
                step('CV_REVIEWED', 'Ramener dans le pipeline (CV examiné)', 'fas fa-undo text-info'),
                step('PHONE_SCREENING', 'Ramener en entretien téléphonique', 'fas fa-phone text-warning'),
                withdraw];
      case 'INTERVIEW_SCHEDULED':
        return [hire, confirmReject, withdraw];
      case 'AUTO_REJECTED':
        // Le RH arbitre la décision de l'IA : soit il la confirme après examen (le refus
        // devient une décision humaine motivée), soit il estime que l'IA s'est trompée et
        // corrige le score depuis la fiche — seule voie qui ramène le dossier en pipeline,
        // parce qu'elle impose une justification et passe au journal d'audit.
        return [confirmReject];
      default:
        return [];
    }
  }

  /**
   * Note affichée sous la liste des actions RH d'un dossier rejeté par l'IA : elle
   * nomme les deux arbitraires humains possibles et dit ce que chacun fait côté
   * notification, pour que le RH n'ait pas à deviner si le candidat va être relancé.
   */
  iaArbitrationHint(status: string): string | null {
    if (status !== 'AUTO_REJECTED') return null;
    return 'Le candidat a déjà reçu l’e-mail de refus de l’Agent 3. « Confirmer le refus » '
      + 'trace votre décision sans le renvoyer ; pour ramener le dossier dans le pipeline, '
      + 'utilisez « Corriger le score » dans la fiche du candidat.';
  }

  /** Applique la transition choisie dans la liste contextuelle. */
  onTransition(candidate: Candidate, t: { key: string; kind: 'status' | 'accept' | 'reject' | 'final-hire' | 'final-reject' }): void {
    if (t.kind === 'accept') { this.acceptCandidate(candidate); }
    else if (t.kind === 'reject') { this.rejectCandidate(candidate); }
    else if (t.kind === 'final-hire') { this.openFinalValidation(candidate, 'HIRED'); }
    else if (t.kind === 'final-reject') { this.openFinalValidation(candidate, 'REJECTED'); }
    else { this.updateCandidateStatus(candidate, t.key); }
  }

  /**
   * Message de toast (vert) spécifique au nouveau statut, pour informer clairement
   * le RH/Admin de l'effet métier de son action — notamment le routage automatique
   * du dossier vers le manager compétent lors de la validation du CV. Le nom affiché
   * vient du backend (destinataires résolus, puis figés sur le dossier) : jamais
   * d'une déduction côté client.
   */
  private statusChangeToast(backendStatus: string, candidate: Candidate,
                            preview?: RoutingPreview): { message: string; title: string } {
    switch (backendStatus) {
      case 'CV_REVIEWED':
        return {
          title: 'CV examiné',
          message: 'Le candidat est informé que son profil est présélectionné.'
        };
      case 'PHONE_SCREENING':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien téléphonique.' };
      case 'TECHNICAL_TEST': {
        const names = this.routedNames(candidate, preview);
        return {
          title: 'Transmis au manager',
          message: names
            ? `Entretien téléphonique validé : le dossier a été transmis à ${names} pour la phase technique.`
            : 'Entretien téléphonique validé : le dossier a été transmis pour la phase technique.'
        };
      }
      case 'INTERVIEW':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien.' };
      case 'FINAL_INTERVIEW':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien final.' };
      case 'INTERVIEW_SCHEDULED':
        return { title: 'Entretien planifié', message: 'Entretien planifié pour ce candidat.' };
      case 'ACCEPTED':
        return {
          title: 'Avis favorable enregistré',
          message: "Le RH est informé : la décision finale (embauche) lui revient et l'e-mail de convocation n'est envoyé qu'après sa validation."
        };
      case 'MANAGER_REJECTED':
        return {
          title: 'Refus proposé',
          message: 'Le RH est informé de votre proposition de refus et valide (ou renverse) cette décision.'
        };
      case 'REJECTED':
        return { title: 'Refus final', message: 'Candidature refusée. Le candidat en est notifié par e-mail.' };
      case 'AUTO_REJECTED':
        return { title: 'Rejet automatique', message: 'Candidat rejeté (score IA insuffisant).' };
      case 'HIRED':
        return { title: 'Embauche validée', message: 'Candidat embauché. Le candidat reçoit sa convocation.' };
      case 'WITHDRAWN':
        return { title: 'Candidature retirée', message: 'La candidature a été marquée comme retirée.' };
      case 'APPLIED':
        return { title: 'Statut modifié', message: 'Candidat replacé au statut « Candidature soumise ».' };
      default:
        return { title: 'Statut modifié', message: 'Statut du candidat mis à jour avec succès !' };
    }
  }

  /**
   * Avis du manager : uniquement sur les dossiers transmis pour évaluation technique, c'est-à-dire
   * ceux de sa liste. L'avis n'est pas la décision finale : il part en contreseing RH.
   * Même périmètre que Candidate#isAwaitingManagerAdvice côté serveur.
   */
  canManagerAdvise(candidate: Candidate): boolean {
    return ['TECHNICAL_TEST', 'INTERVIEW', 'FINAL_INTERVIEW'].includes(candidate.status);
  }

  /**
   * Un avis est-il déjà posé sur ce dossier ? Si oui, le manager n'a plus rien à
   * saisir — le contreseing appartient au RH. Sans ce message, les deux boutons
   * simplement grisés laissaient croire à une interface en panne.
   */
  managerAdviceNote(candidate: Candidate): string | null {
    const author = candidate.statusChangedBy ? ` (${candidate.statusChangedBy})` : '';
    if (candidate.status === 'ACCEPTED') {
      return `Avis favorable déjà enregistré${author} — en attente de validation du RH`;
    }
    if (candidate.status === 'MANAGER_REJECTED') {
      return `Refus proposé déjà enregistré${author} — en attente du contreseing du RH`;
    }
    // Rejet prononcé par l'IA : le manager n'a aucune prise dessus, seul le RH
    // peut le confirmer ou corriger le score. Sans ce message, deux boutons
    // grisés feraient croire à un écran en panne.
    if (candidate.status === 'AUTO_REJECTED') {
      return 'Décision de l’IA — confirmation ou correction réservée au RH';
    }
    return null;
  }

  /**
   * Ligne « RH » de la frise n8n de la fiche : c'est la validation RH qui déclenche
   * l'Agent 2, elle ne peut donc plus être annoncée « à venir » sur un dossier engagé.
   * Renvoie null tant que le dossier est au stade APPLIED (attente réelle).
   */
  hrValidationStep(candidate: Candidate): string | null {
    if (candidate.status === 'APPLIED') return null;
    if (candidate.status === 'AUTO_REJECTED') {
      return 'Rejet prononcé par l’agent IA, sans validation RH — arbitrage humain encore possible';
    }
    if (candidate.status === 'REJECTED') {
      return 'Refus acté par le RH — motif enregistré au journal d’audit, Agent 2 non déclenché';
    }
    if (candidate.status === 'MANAGER_REJECTED') {
      return 'Refus proposé par le manager — en attente du contreseing du RH';
    }
    if (candidate.status === 'WITHDRAWN') {
      return 'Candidature retirée par le candidat — processus arrêté avant la validation RH';
    }
    return 'Validation RH effectuée — Agent 2 déclenché pour la planification de l’entretien';
  }

  acceptCandidate(candidate: Candidate): void {
    this.candidateService.managerDecision(candidate.id, 'ACCEPTED').subscribe({
      next: () => {
        this.toastrNotification.showSuccess(
          'Avis favorable enregistré. Le RH est informé et valide la décision finale.',
          'Avis transmis au RH');
        candidate.status = 'ACCEPTED' as Candidate['status'];
        this.rememberStatus(candidate.id, 'ACCEPTED');
        this.applyFilters();
        this.openStatusDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'acceptation du candidat:', error);
        const message = error?.error?.message || 'Erreur lors de l\'acceptation du candidat';
        this.toastrNotification.showCandidateError(message);
        this.openStatusDropdownId = null;
      }
    });
  }

  rejectCandidate(candidate: Candidate): void {
    const reason = window.prompt('Motif obligatoire du refus :');
    if (!reason?.trim()) {
      this.toastrNotification.showCandidateError('Le motif du refus est obligatoire');
      return;
    }
    this.candidateService.managerDecision(candidate.id, 'REJECTED', reason.trim()).subscribe({
      next: (updated: Candidate) => {
        if (this.isManagerView) {
          this.toastrNotification.showSuccess(
            'Refus proposé enregistré. Le RH est informé et valide la décision finale.',
            'Avis transmis au RH');
        } else {
          this.toastrNotification.showSuccess(
            'Candidature refusée. Le candidat en est notifié par e-mail.',
            'Refus final');
        }
        const status = (updated?.status || (this.isManagerView ? 'MANAGER_REJECTED' : 'REJECTED')) as Candidate['status'];
        candidate.status = status;
        this.rememberStatus(candidate.id, status);
        this.applyFilters();
        this.openStatusDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors du refus du candidat:', error);
        const message = error?.error?.message || 'Erreur lors du refus du candidat';
        this.toastrNotification.showCandidateError(message);
        this.openStatusDropdownId = null;
      }
    });
  }

  /**
   * Contre-signature RH de l'avis du manager : seule cette action produit une décision
   * finale (HIRED / REJECTED) et l'e-mail correspondant au candidat.
   */
  openFinalValidation(candidate: Candidate, decision: 'HIRED' | 'REJECTED'): void {
    this.finalValidationCandidate = candidate;
    this.finalValidationDecision = decision;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    defaultDate.setHours(9, 0, 0, 0);
    this.finalValidationForm.reset({
      presentationDate: decision === 'HIRED' ? this.toDateTimeLocal(defaultDate) : '',
      reason: candidate.statusReason || ''
    });
    this.finalValidationForm.get('presentationDate')!
      .setValidators(decision === 'HIRED' ? [Validators.required] : []);
    this.finalValidationForm.get('reason')!
      .setValidators(decision === 'REJECTED' ? [Validators.required, Validators.minLength(5)] : []);
    this.finalValidationForm.updateValueAndValidity();
    this.showFinalValidationModal = true;
    this.openStatusDropdownId = null;
  }

  closeFinalValidation(): void {
    this.showFinalValidationModal = false;
    this.finalValidationCandidate = undefined;
    this.savingFinalValidation = false;
  }

  get nowDateTimeLocal(): string {
    return this.toDateTimeLocal(new Date());
  }

  private toDateTimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  submitFinalValidation(): void {
    if (!this.finalValidationCandidate || this.finalValidationForm.invalid) {
      this.finalValidationForm.markAllAsTouched();
      return;
    }
    const candidate = this.finalValidationCandidate;
    const decision = this.finalValidationDecision;
    const rawDate = this.finalValidationForm.value.presentationDate;
    const reason = (this.finalValidationForm.value.reason || '').trim();

    this.savingFinalValidation = true;
    // Le refus d'un dossier déjà rejeté par l'IA est un contreseing humain : le candidat
    // a reçu l'e-mail de l'Agent 3, le backend ne renvoie rien. Le toast doit le dire.
    const confirmingIaRejection = decision === 'REJECTED' && candidate.status === 'AUTO_REJECTED';
    // Le champ datetime-local fournit déjà un format ISO local (2026-10-20T09:00)
    // directement parsable en LocalDateTime côté Spring — pas de conversion Fuseau.
    this.candidateService.finalValidation(
      candidate.id,
      decision,
      decision === 'HIRED' ? rawDate : undefined,
      decision === 'REJECTED' ? reason : undefined
    ).subscribe({
      next: (updated: Candidate) => {
        const status = (updated?.status || decision) as Candidate['status'];
        candidate.status = status;
        this.rememberStatus(candidate.id, status);
        this.savingFinalValidation = false;
        this.showFinalValidationModal = false;
        this.finalValidationCandidate = undefined;
        this.applyFilters();
        this.toastrNotification.showSuccess(
          decision === 'HIRED'
            ? 'Embauche validée. Le candidat reçoit sa convocation avec la date de présentation des documents.'
            : confirmingIaRejection
              ? 'Refus de l’IA confirmé après examen humain. Le candidat a déjà été notifié : aucun second e-mail.'
              : 'Refus final validé. Le candidat en est notifié par e-mail.',
          decision === 'HIRED' ? 'Décision finale validée' : 'Refus final validé');
      },
      error: (error: any) => {
        console.error('Erreur lors de la validation finale:', error);
        this.savingFinalValidation = false;
        const message = error?.error?.message || 'Erreur lors de la validation finale.';
        this.toastrNotification.showError(message, 'Validation impossible');
      }
    });
  }

  /**
   * Mappe le statut du frontend vers l'enum backend
   */
  private mapStatusToBackend(status: string): string {
    switch (status) {
      case 'ACTIVE':
      case 'PENDING':
        return 'APPLIED';
      case 'REVIEWED':
        return 'CV_REVIEWED';
      case 'INTERVIEWED':
        return 'INTERVIEW';
      case 'ACCEPTED':
      case 'HIRED':
        return 'ACCEPTED';
      case 'REJECTED':
        return 'REJECTED';
      case 'AUTO_REJECTED':
        return 'AUTO_REJECTED';
      case 'MANAGER_REJECTED':
        return 'MANAGER_REJECTED';
      case 'INACTIVE':
        return 'WITHDRAWN';
      // Statuts déjà au format backend — pass-through
      case 'APPLIED':
      case 'CV_REVIEWED':
      case 'PHONE_SCREENING':
      case 'TECHNICAL_TEST':
      case 'INTERVIEW':
      case 'FINAL_INTERVIEW':
      case 'WITHDRAWN':
        return status;
      default:
        return 'APPLIED';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'APPLIED':
        return 'badge bg-primary';
      case 'CV_REVIEWED':
        return 'badge bg-info';
      case 'PHONE_SCREENING':
      case 'TECHNICAL_TEST':
        return 'badge bg-warning text-dark';
      case 'INTERVIEW':
      case 'FINAL_INTERVIEW':
        return 'badge bg-primary';
      case 'ACCEPTED':
        // Avis à contre-signer : la couleur « action requise » plutôt que le vert final.
        return 'badge bg-warning text-dark';
      case 'HIRED':
        return 'badge bg-success';
      case 'INTERVIEW_SCHEDULED':
        return 'badge bg-info text-dark';
      case 'REJECTED':
      case 'AUTO_REJECTED':
      case 'MANAGER_REJECTED':
        return 'badge bg-danger';
      case 'WITHDRAWN':
        return 'badge bg-secondary';
      default:
        return 'badge bg-light text-dark';
    }
  }

  getStatusText(status: string): string {
    return this.getStatusLabel(status);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  clearFilters(): void {
    this.searchForm.reset();
    this.currentPage = 1;
  }

  exportCandidates(): void {
    // Implémentation de l'export CSV/Excel
    const csvData = this.filteredCandidates.map(candidate => ({
      'Prénom': candidate.firstName,
      'Nom': candidate.lastName,
      'Email': candidate.email,
      'Téléphone': candidate.phone,
      'Statut': this.getStatusText(candidate.status),
      'Offre d\'emploi': candidate.jobOfferTitle || 'N/A',
      'Date de candidature': this.formatDate(candidate.applicationDate)
    }));
    
    // Conversion en CSV et téléchargement
    const csv = this.convertToCSV(csvData);
    this.downloadCSV(csv, 'candidats.csv');
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Méthodes pour le système d'email
  openEmailModal(candidate: Candidate): void {
    this.selectedCandidate = candidate;
    this.showEmailModal = true;
  }

  closeEmailModal(): void {
    this.showEmailModal = false;
    this.selectedCandidate = undefined;
  }

  onEmailSent(): void {
    console.log('Email envoyé avec succès');
    // Optionnel: recharger les données ou afficher une notification
  }

  sendApplicationConfirmation(candidate: Candidate): void {
    this.notificationService.sendApplicationConfirmation(candidate.id).subscribe({
      next: (response: any) => {
        this.toastrNotification.showEmailSentSuccess();
        this.openEmailDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        this.toastrNotification.showEmailSentError();
        this.openEmailDropdownId = null;
      }
    });
  }

  /**
   * Envoie le vrai email d'invitation (avec date/heure/lieu réels) pour le
   * prochain entretien planifié du candidat, via l'endpoint dédié
   * /api/notifications/interview-invitation/{interviewId}.
   */
  sendInterviewInvitation(candidate: Candidate): void {
    this.interviewService.getInterviewsByCandidate(candidate.id).subscribe({
      next: (interviews) => {
        const upcoming = interviews
          .filter(iv => iv.status === 'SCHEDULED' || iv.status === 'RESCHEDULED')
          .sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime())[0];

        if (!upcoming) {
          this.toastrNotification.showWarning(
            "Aucun entretien planifié pour ce candidat — créez d'abord un entretien avant d'envoyer une invitation."
          );
          this.openEmailDropdownId = null;
          return;
        }

        this.notificationService.sendInterviewInvitation(upcoming.id).subscribe({
          next: () => {
            this.toastrNotification.showEmailSentSuccess();
            this.openEmailDropdownId = null;
          },
          error: (error: any) => {
            console.error('Erreur lors de l\'envoi de l\'invitation à l\'entretien:', error);
            this.toastrNotification.showEmailSentError();
            this.openEmailDropdownId = null;
          }
        });
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des entretiens du candidat:', error);
        this.toastrNotification.showError('Impossible de récupérer les entretiens de ce candidat');
        this.openEmailDropdownId = null;
      }
    });
  }

  /**
   * Envoie au candidat le dernier feedback le concernant, via l'endpoint
   * dédié /api/feedbacks/{id}/send-detailed-notification.
   */
  sendFeedbackNotification(candidate: Candidate): void {
    this.feedbackService.getFeedbacksByCandidate(candidate.id).subscribe({
      next: (feedbacks) => {
        const latest = [...feedbacks]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (!latest) {
          this.toastrNotification.showWarning('Aucun feedback disponible pour ce candidat.');
          this.openEmailDropdownId = null;
          return;
        }

        const notificationData: FeedbackNotificationRequest = {
          subject: 'Retour sur votre candidature',
          message: latest.content,
          feedbackSummary: `Note : ${latest.rating}/5`
        };

        this.notificationService.sendDetailedFeedbackNotification(latest.id, notificationData).subscribe({
          next: () => {
            this.toastrNotification.showEmailSentSuccess();
            this.openEmailDropdownId = null;
          },
          error: (error: any) => {
            console.error('Erreur lors de l\'envoi du feedback:', error);
            this.toastrNotification.showEmailSentError();
            this.openEmailDropdownId = null;
          }
        });
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des feedbacks du candidat:', error);
        this.toastrNotification.showError('Impossible de récupérer les feedbacks de ce candidat');
        this.openEmailDropdownId = null;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'APPLIED': 'Candidature soumise',
      'CV_REVIEWED': 'CV examiné',
      'PHONE_SCREENING': 'Entretien téléphonique',
      'TECHNICAL_TEST': 'Test technique',
      'INTERVIEW': 'Entretien',
      'FINAL_INTERVIEW': 'Entretien final',
      'ACCEPTED': 'Avis favorable — à valider',
      'INTERVIEW_SCHEDULED': 'Entretien planifié — à valider',
      'HIRED': 'Embauché (validé RH)',
      'REJECTED': 'Rejeté',
      'AUTO_REJECTED': 'Rejeté (IA)',
      'MANAGER_REJECTED': 'Refus proposé — à valider',
      'WITHDRAWN': 'Candidature retirée'
    };
    return statusLabels[status] || status;
  }

  openCV(url: string): void {
    window.open(url, '_blank');
  }
}

