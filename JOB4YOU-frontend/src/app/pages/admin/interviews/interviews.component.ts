import { environment } from "../../../../environments/environment";
import { defaultOrderFor } from '../../../services/table-sort';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { InterviewService } from '../../../services/interview.service';
import { InterviewerService, Interviewer } from '../../../services/interviewer.service';
import { Interview } from '../../../models/interfaces';
import { CandidateService } from '../../../services/candidate.service';
import { AuthService } from '../../../services/auth';
import { FeedbackService } from '../../../services/feedback.service';
import { CVService } from '../../../services/cv.service';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-interviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './interviews.component.html',
  styleUrl: './interviews.component.scss'
})
export class InterviewsComponent implements OnInit {
  interviews: Interview[] = [];
  filteredInterviews: Interview[] = [];
  candidates: any[] = [];
  interviewers: Interviewer[] = [];
  readonly interviewTypes = [
    { value: 'PHONE_SCREENING', label: 'Entretien téléphonique', rhOnly: true },
    { value: 'TECHNICAL', label: 'Entretien technique', rhOnly: false },
    { value: 'HR', label: 'Entretien RH', rhOnly: true },
    { value: 'MANAGER', label: 'Entretien manager', rhOnly: false },
    { value: 'FINAL', label: 'Entretien final', rhOnly: false },
    { value: 'GROUP', label: 'Entretien de groupe', rhOnly: false }
  ];
  loading = true;
  error: string | null = null;
  
  // Propriété pour le contrôle d'accès aux CVs
  userCanViewCV = false;
  
  // Sélection des entretiens
  selectedInterviews: Set<number> = new Set();
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalInterviews = 0;
  totalPages = 0;
  
  // Filters
  searchForm: FormGroup;
  searchTerm = '';
  selectedStatus = '';
  selectedType = '';
  selectedDateRange = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  sortBy = 'interviewDate';
  sortOrder = 'asc';
  
  // Modal states
  showInterviewModal = false;
  showFeedbackModal = false;
  showConsultationModal = false;
  showNotificationModal = false;
  showConfirmationModal = false;
  selectedInterview: Interview | null = null;
  confirmationAction: (() => void) | null = null;
  confirmationMessage = '';
  confirmationTitle = '';
  interviewForm: FormGroup;
  feedbackForm: FormGroup;
  notificationForm: FormGroup;
  
  // Notification states
  notificationTypes = [
    { value: 'INTERVIEW_CONFIRMATION', label: 'Confirmation d\'entretien' },
    { value: 'INTERVIEW_REMINDER', label: 'Rappel d\'entretien' },
    { value: 'INTERVIEW_RESCHEDULED', label: 'Reprogrammation' },
    { value: 'INTERVIEW_CANCELLED', label: 'Annulation' },
    { value: 'FEEDBACK_REQUEST', label: 'Demande de feedback' }
  ];
  
  // Calendar view
  showCalendarView = false;
  calendarDate = new Date();
  calendarDays: { date: Date; interviews: Interview[] }[] = [];

  // Créneaux déjà réservés à l'intervieweur pour la journée en cours de préparation
  interviewerDaySlots: Interview[] = [];
  private interviewerDayCache = new Map<number, Interview[]>();

  readonly Math = Math;

  constructor(
    private interviewService: InterviewService,
    private candidateService: CandidateService,
    private authService: AuthService,
    private feedbackService: FeedbackService,
    private cvService: CVService,
    private fb: FormBuilder,
    private toastrNotification: ToastrNotificationService,
    private notificationService: NotificationService,
    private http: HttpClient,
    private interviewerService: InterviewerService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      type: [''],
      dateRange: ['']
    });
    
    this.interviewForm = this.fb.group({
      candidateId: ['', Validators.required],
      interviewerId: ['', Validators.required],
      interviewDate: ['', Validators.required],
      duration: [60, [Validators.required, Validators.min(15)]],
      location: ['', Validators.required],
      type: ['TECHNICAL', Validators.required],
      notes: ['']
    });

    this.feedbackForm = this.fb.group({
      feedback: ['', Validators.required],
      rating: ['', [Validators.min(1), Validators.max(5)]]
    });

    this.notificationForm = this.fb.group({
      notificationType: ['', Validators.required],
      subject: ['', Validators.required],
      message: ['', Validators.required],
      sendToCandidate: [true],
      sendToInterviewer: [false],
      copyToHR: [true]
    });
  }

  /** Dossier pré-sélectionné demandé par lien profond depuis la liste des candidats. */
  private pendingPlanCandidateId: number | null = null;

  ngOnInit(): void {
    // Initialiser la propriété d'accès aux CVs
    this.userCanViewCV = this.canViewCV();
    this.pendingPlanCandidateId = Number(this.route.snapshot.queryParamMap.get('newFor')) || null;

    this.loadInterviews();
    this.loadCandidates();
    this.loadInterviewers();
    this.setupSearchSubscription();
    this.setupInterviewerDayPreview();
  }

  loadInterviews(): void {
    this.loading = true;
    this.error = null;
    
    this.interviewService.getInterviews().subscribe({
      next: (interviews: Interview[]) => {
        this.interviews = interviews;
        this.totalInterviews = interviews.length;
        this.totalPages = Math.ceil(this.totalInterviews / this.pageSize);
        this.applyFilters();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des entretiens:', error);
        this.error = 'Erreur lors du chargement des entretiens';
        this.loading = false;
      }
    });
  }

  /**
   * Un manager ne planifie que sur les dossiers qui lui ont été transmis : la liste des
   * candidats reprend le périmètre de « ma liste de dossiers » (getValidatedCandidates),
   * alors que la liste RH serait complète et proposerait des dossiers que le serveur refuse
   * (APPLIED non validé, dossier clôturé).
   */
  loadCandidates(): void {
    const fetch$ = this.plansOwnAgendaOnly
      ? this.candidateService.getValidatedCandidates()
      : this.candidateService.getCandidates();
    fetch$.subscribe({
      next: (candidates: any[]) => {
        this.candidates = candidates;
        this.openPendingPlan();
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    });
  }

  loadInterviewers(): void {
    console.log('[DEBUG] Début du chargement des interviewers...');
    // Charger dynamiquement la liste des interviewers depuis l'API
    this.interviewerService.getInterviewers().subscribe({
      next: (interviewers: Interviewer[]) => {
        this.interviewers = interviewers;
        console.log('[DEBUG] Interviewers chargés avec succès:', interviewers);
        console.log('[DEBUG] Nombre d\'interviewers:', interviewers.length);
        this.prefillOwnAsInterviewer();
      },
      error: (error: any) => {
        console.error('[ERROR] Erreur lors du chargement des interviewers:', error);
        console.log('[DEBUG] Utilisation de la liste de fallback...');
        // Fallback avec la liste statique en cas d'erreur
        this.interviewers = [
          { id: 1, name: 'Jean Dupont', role: 'RH Manager', email: 'jean.dupont@example.com' },
          { id: 2, name: 'Marie Martin', role: 'Tech Lead', email: 'marie.martin@example.com' },
          { id: 3, name: 'Pierre Durand', role: 'Senior Developer', email: 'pierre.durand@example.com' }
        ];
        console.log('[DEBUG] Liste de fallback activée:', this.interviewers);
        this.prefillOwnAsInterviewer();
      }
    });
  }

  /**
   * Un manager sans rôle RH/Admin n'instruit que les dossiers qui lui sont routés et ne tient
   * que son propre agenda : l'intervieweur est figé sur son propre compte. Le serveur applique
   * la même règle (InterviewService.assertInterviewerAssignmentAllowed).
   */
  get plansOwnAgendaOnly(): boolean {
    return this.authService.isManager() && !this.authService.isHR() && !this.authService.isAdmin();
  }

  get currentUserId(): number | null {
    return this.authService.getCurrentUser()?.id ?? null;
  }

  get ownInterviewerLabel(): string {
    const me = this.interviewers.find(i => i.id === this.currentUserId);
    if (me) return `${me.name} - ${me.role}`;
    const user = this.authService.getCurrentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'Votre compte';
  }

  /**
   * L'offre n'est pas une donnée de l'entretien : le backend la déduit du dossier du candidat.
   * Elle n'est donc affichée qu'à titre informatif.
   */
  get selectedOfferTitle(): string {
    if (this.selectedInterview?.jobOfferTitle) return this.selectedInterview.jobOfferTitle;
    const candidateId = Number(this.interviewForm.get('candidateId')?.value);
    return this.candidates.find(c => c.id === candidateId)?.jobOfferTitle || '';
  }

  get visibleInterviewTypes(): { value: string; label: string; rhOnly: boolean }[] {
    return this.plansOwnAgendaOnly
      ? this.interviewTypes.filter(t => !t.rhOnly)
      : this.interviewTypes;
  }

  private prefillOwnAsInterviewer(): void {
    if (this.plansOwnAgendaOnly && this.currentUserId !== null && !this.selectedInterview) {
      this.interviewForm.get('interviewerId')?.setValue(String(this.currentUserId));
    }
  }

  setupSearchSubscription(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  /**
   * Plusieurs entretiens le même jour sont possibles, pas à la même heure. Plutôt que de
   * laisser l'utilisateur découvrir le chevauchement à l'enregistrement, l'agenda du jour
   * est affiché dès que l'intervieweur, la date ou la durée change.
   */
  setupInterviewerDayPreview(): void {
    ['interviewerId', 'interviewDate', 'duration'].forEach(control =>
      this.interviewForm.get(control)?.valueChanges.subscribe(() => this.refreshInterviewerDay()));
  }

  refreshInterviewerDay(): void {
    const interviewerId = Number(this.interviewForm.get('interviewerId')?.value);
    const date = this.interviewForm.get('interviewDate')?.value;
    if (!interviewerId || !date) {
      this.interviewerDaySlots = [];
      return;
    }
    const show = (all: Interview[]) => (this.interviewerDaySlots = this.bookedSlotsOn(all, new Date(date)));
    const cached = this.interviewerDayCache.get(interviewerId);
    if (cached) {
      show(cached);
      return;
    }
    this.interviewService.getInterviewsByInterviewer(interviewerId).subscribe({
      next: (all: Interview[]) => {
        this.interviewerDayCache.set(interviewerId, all);
        show(all);
      },
      // L'aperçu reste un confort : le serveur refusera de toute façon le chevauchement.
      error: () => (this.interviewerDaySlots = [])
    });
  }

  /** Créneaux qui occupent ce jour-là : hors entretien annulé et hors entretien en cours d'édition. */
  private bookedSlotsOn(interviews: Interview[], day: Date): Interview[] {
    const sameDay = (date: Date | string) => {
      const other = new Date(date);
      return other.getFullYear() === day.getFullYear()
        && other.getMonth() === day.getMonth()
        && other.getDate() === day.getDate();
    };
    return interviews
      .filter(iv => iv.status !== 'CANCELLED' && iv.id !== this.selectedInterview?.id && sameDay(iv.interviewDate))
      .sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime());
  }

  /** Le créneau en préparation retombe-t-il sur une réservation déjà prise ? */
  slotConflict(): Interview | null {
    const date = this.interviewForm.get('interviewDate')?.value;
    if (!date) return null;
    const start = new Date(date).getTime();
    const end = start + this.durationOf(Number(this.interviewForm.get('duration')?.value)) * 60000;
    return this.interviewerDaySlots.find(other => {
      const otherStart = new Date(other.interviewDate).getTime();
      return start < otherStart + this.durationOf(other.durationMinutes) * 60000 && otherStart < end;
    }) ?? null;
  }

  formatSlotEnd(interview: Interview): string {
    const end = new Date(interview.interviewDate).getTime() + this.durationOf(interview.durationMinutes) * 60000;
    return this.formatTime(new Date(end));
  }

  interviewerDayLabel(): string | null {
    const date = this.interviewForm.get('interviewDate')?.value;
    if (!date || !this.interviewForm.get('interviewerId')?.value) return null;
    return `Journée de ${this.selectedInterviewerName()} le ${this.formatDate(date)}`;
  }

  private selectedInterviewerName(): string {
    if (this.plansOwnAgendaOnly) return this.ownInterviewerLabel;
    const interviewer = this.interviewers.find(i => i.id === Number(this.interviewForm.get('interviewerId')?.value));
    return interviewer ? interviewer.name : 'l’intervieweur';
  }

  /** Une durée manquante retombe sur les 60 minutes du formulaire, comme côté serveur. */
  private durationOf(minutes?: number | null): number {
    const value = Number(minutes);
    return value > 0 ? value : 60;
  }

  applyFilters(): void {
    const { searchTerm, status, type, dateRange } = this.searchForm.value;
    
    this.filteredInterviews = this.interviews.filter(interview => {
      const matchesSearch = !searchTerm || 
        (interview.candidateName && interview.candidateName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (interview.jobOfferTitle && interview.jobOfferTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (interview.interviewerName && interview.interviewerName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = !status || interview.status === status;
      const matchesType = !type || interview.type === type;
      
      let matchesDateRange = true;
      if (dateRange) {
        const today = new Date();
        const interviewDate = new Date(interview.interviewDate);
        
        switch (dateRange) {
          case 'today':
            matchesDateRange = interviewDate.toDateString() === today.toDateString();
            break;
          case 'week':
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            matchesDateRange = interviewDate >= today && interviewDate <= weekFromNow;
            break;
          case 'month':
            const monthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            matchesDateRange = interviewDate >= today && interviewDate <= monthFromNow;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesDateRange;
    });
    
    this.sortInterviews();
    this.updatePagination();
  }

  getFilteredInterviews(): Interview[] {
    return this.filteredInterviews;
  }

  sortInterviews(): void {
    this.filteredInterviews.sort((a, b) => {
      let aValue: any = a[this.sortBy as keyof Interview];
      let bValue: any = b[this.sortBy as keyof Interview];
      
      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (aValue && bValue) {
        if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  updatePagination(): void {
    this.totalInterviews = this.filteredInterviews.length;
    this.totalPages = Math.ceil(this.totalInterviews / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  /**
   * Retourne les entretiens pour la page courante
   */
  getPaginatedInterviews(): Interview[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredInterviews.slice(startIndex, endIndex);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  changeSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = defaultOrderFor(field);
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fas fa-sort';
    return this.sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  /**
   * Lien profond « ?newFor=<id> » envoyé par le bouton Planifier l'entretien de la liste des
   * candidats : la popup s'ouvre avec le dossier déjà sélectionné. Elle ne peut s'ouvrir qu'une
   * fois la liste des dossiers reçue, faute de quoi le champ « Candidat » perdrait la valeur.
   */
  private openPendingPlan(): void {
    const candidateId = this.pendingPlanCandidateId;
    if (candidateId == null || candidateId <= 0) { return; }
    this.pendingPlanCandidateId = null;

    if (!this.candidates.some(c => c.id === candidateId)) {
      this.toastrNotification.showWarning(
        'Ce dossier n\'est pas dans votre périmètre : il n\'a pas pu être pré-sélectionné.',
        'Planification refusée');
      return;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });

    this.openInterviewModal();
    this.interviewForm.get('candidateId')?.setValue(String(candidateId));
    if (this.plansOwnAgendaOnly) {
      // Un manager qui se programme lui-même ouvre un entretien avec le manager.
      this.interviewForm.get('type')?.setValue('MANAGER');
    }
  }

  openInterviewModal(interview?: Interview): void {
    this.selectedInterview = interview || null;
    
    if (interview) {
      this.ensureCandidateListed(interview);
      const scheduledDate = new Date(interview.interviewDate);
      const formattedDate = scheduledDate.toISOString().slice(0, 16);
      
      this.interviewForm.patchValue({
        candidateId: interview.candidateId,
        interviewerId: String(interview.interviewerId),
        interviewDate: formattedDate,
        duration: interview.durationMinutes,
        location: interview.location,
        type: interview.type,
        notes: interview.notes
      });
    } else {
      this.interviewForm.reset();
      this.interviewForm.patchValue({
        type: 'TECHNICAL',
        duration: 60
      });
      this.prefillOwnAsInterviewer();
    }
    
    this.showInterviewModal = true;
  }

  /**
   * Un dossier instruit peut avoir quitté la liste du manager (refus validé, embauche) alors
   * que son entretien reste modifiable : sans cette ligne le champ « Candidat » se viderait.
   */
  private ensureCandidateListed(interview: Interview): void {
    if (!this.plansOwnAgendaOnly || interview.candidateId == null) return;
    if (this.candidates.some(c => c.id === interview.candidateId)) return;
    this.candidates = [
      { id: interview.candidateId, firstName: interview.candidateName || 'Candidat', lastName: '' },
      ...this.candidates
    ];
  }

  closeInterviewModal(): void {
    this.showInterviewModal = false;
    this.selectedInterview = null;
    this.interviewForm.reset();
  }

  saveInterview(): void {
    if (this.interviewForm.valid) {
      const interviewData = this.interviewForm.value;
      
      // Validation des champs obligatoires
      if (!interviewData.candidateId || !interviewData.interviewerId || !interviewData.interviewDate) {
        this.toastrNotification.showValidationError('Tous les champs obligatoires doivent être remplis');
        return;
      }
      
      // Validation des IDs
      const candidateId = Number(interviewData.candidateId);
      const interviewerId = Number(interviewData.interviewerId);
      
      if (isNaN(candidateId) || candidateId <= 0) {
        this.toastrNotification.showValidationError('ID du candidat invalide');
        return;
      }
      
      if (isNaN(interviewerId) || interviewerId <= 0) {
        this.toastrNotification.showValidationError('ID de l\'interviewer invalide');
        return;
      }

      // Le serveur (InterviewService.assertNoOverlapWithInterviewerAgenda) refuse déjà le
      // chevauchement : le refuser ici évite une erreur 400 et annonce l'heure libre.
      const clash = this.slotConflict();
      if (clash) {
        this.toastrNotification.showInterviewError(
          `Ce créneau chevauche l'entretien de ${clash.candidateName || 'un autre candidat'} `
          + `à ${this.formatTime(clash.interviewDate)} (${this.durationOf(clash.durationMinutes)} min). `
          + `Plusieurs entretiens le même jour sont possibles, mais pas en même temps.`);
        return;
      }
      
      // Conversion de la date au format compatible avec LocalDateTime
      // Format attendu: "2024-12-23T14:30:00"
      const interviewDate = new Date(interviewData.interviewDate);
      const year = interviewDate.getFullYear();
      const month = String(interviewDate.getMonth() + 1).padStart(2, '0');
      const day = String(interviewDate.getDate()).padStart(2, '0');
      const hours = String(interviewDate.getHours()).padStart(2, '0');
      const minutes = String(interviewDate.getMinutes()).padStart(2, '0');
      const seconds = String(interviewDate.getSeconds()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      
      const interviewToSend = {
        interviewDate: formattedDate,
        type: interviewData.type, // Déjà une valeur d'enum backend (cf. options du <select>)
        status: null, // Laisser le backend définir le statut par défaut
        notes: interviewData.notes || null,
        durationMinutes: interviewData.duration ? Number(interviewData.duration) : null,
        location: interviewData.location || null,
        candidateId: candidateId,
        interviewerId: interviewerId
      };
      
      // Log pour débogage
      console.log('Données envoyées au backend:', interviewToSend);
      if (this.selectedInterview) {
        this.interviewService.updateInterview(this.selectedInterview.id, interviewToSend).subscribe({
          next: () => {
            this.toastrNotification.showInterviewUpdatedSuccess();
            this.interviewerDayCache.clear();
            this.loadInterviews();
            this.closeInterviewModal();
          },
          error: (error: any) => {
            console.error("Erreur lors de la mise à jour de l'entretien:", error);
            this.toastrNotification.showInterviewError("Erreur lors de la mise à jour de l'entretien");
            this.error = "Erreur lors de la mise à jour de l'entretien";
          }
        });
      } else {
        this.interviewService.createInterview(interviewToSend).subscribe({
          next: (created: Interview) => {
            this.toastrNotification.showInterviewCreatedSuccess();
            this.interviewerDayCache.clear();
            this.reportPipelineAdvance(created, candidateId);
            this.loadInterviews();
            this.closeInterviewModal();
          },
          error: (error: any) => {
            console.error("Erreur lors de la création de l'entretien:", error);
            console.error("Détails de l'erreur:", error.error);
            console.error("Status:", error.status);
            console.error("Message:", error.message);
            
            let errorMessage = "Erreur lors de la création de l'entretien";
            if (error.status === 400 && error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.status === 500) {
              errorMessage = "Erreur interne du serveur. Vérifiez les logs du backend.";
            }
            
            this.toastrNotification.showInterviewError(errorMessage);
            this.error = errorMessage;
          }
        });
      }
    }
  }

  /**
   * Le serveur place le dossier à l'étape correspondant à l'entretien qu'il vient de créer,
   * sous le contrôle de la machine à états. On rend compte de l'état réellement renvoyé plutôt
   * que de promettre une avancée qu'un pipeline déjà engagé refuserait (un manager ne peut pas,
   * par exemple, faire revenir un dossier en entretien téléphonique).
   */
  private reportPipelineAdvance(created: Interview, candidateId: number): void {
    if (!created?.candidateStatus) { return; }
    const candidate = this.candidates.find(c => c.id === candidateId);
    const previous = candidate?.status;
    if (candidate) { candidate.status = created.candidateStatus as any; }
    if (previous && created.candidateStatus !== previous) {
      this.toastrNotification.showSuccess(
        `Dossier avancé : ${this.getPipelineLabel(previous)} → ${this.getPipelineLabel(created.candidateStatus)}.`,
        'Étape du pipeline');
    } else {
      this.toastrNotification.showInfo(
        `Le dossier reste à l'étape « ${this.getPipelineLabel(created.candidateStatus)} » : `
        + 'la planification de l\'entretien ne remonte pas un pipeline déjà engagé.',
        'Statut inchangé');
    }
  }

  private getPipelineLabel(status: string): string {
    const labels: Record<string, string> = {
      APPLIED: 'Candidature soumise',
      CV_REVIEWED: 'CV examiné',
      PHONE_SCREENING: 'Entretien téléphonique',
      TECHNICAL_TEST: 'Test technique',
      INTERVIEW: 'Entretien',
      FINAL_INTERVIEW: 'Entretien final',
      ACCEPTED: 'Avis favorable du manager',
      MANAGER_REJECTED: 'Refus proposé par le manager',
      INTERVIEW_SCHEDULED: 'Entretien planifié',
      REJECTED: 'Refus validé',
      AUTO_REJECTED: 'Rejet automatique (IA)',
      HIRED: 'Candidat embauché',
      WITHDRAWN: 'Candidature retirée'
    };
    return labels[status] ?? status;
  }

  /**
   * Confirme la suppression d'un entretien directement
   */
  confirmDeleteInterview(interview: Interview): void {
    this.selectedInterview = interview;
    this.confirmationTitle = 'Supprimer l\'entretien';
    this.confirmationMessage = `Êtes-vous sûr de vouloir supprimer l'entretien avec ${interview.candidateName} ? Cette action est irréversible.`;
    this.confirmationAction = () => {
      this.performDeleteInterview();
    };
    this.showConfirmationModal = true;
  }

  private performDeleteInterview(): void {
    if (this.selectedInterview) {
      this.interviewService.deleteInterview(this.selectedInterview.id).subscribe({
        next: () => {
          this.toastrNotification.showInterviewDeletedSuccess();
          this.loadInterviews();
          this.closeConfirmationModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de l\'entretien:', error);
          this.toastrNotification.showInterviewError('Erreur lors de la suppression de l\'entretien');
          this.error = 'Erreur lors de la suppression de l\'entretien';
        }
      });
    }
  }

  /**
   * Ouvre le modal de feedback pour un entretien
   */
  openFeedbackModal(interview: Interview): void {
    this.selectedInterview = interview;
    this.feedbackForm.reset();
    this.showFeedbackModal = true;
  }

  /**
   * Ferme le modal de feedback
   */
  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.selectedInterview = null;
    this.feedbackForm.reset();
  }

  /**
   * Soumet un feedback pour l'entretien sélectionné
   */
  submitFeedback(): void {
    if (this.feedbackForm.valid && this.selectedInterview) {
      // Doit correspondre à FeedbackRequest.java : "content" (pas "feedback") et
      // "type" sont requis côté backend, sans quoi la requête est rejetée (400).
      const feedbackData = {
        interviewId: this.selectedInterview.id,
        candidateId: this.selectedInterview.candidateId,
        content: this.feedbackForm.value.feedback,
        rating: this.feedbackForm.value.rating,
        type: 'INTERVIEW'
      };

      this.feedbackService.createFeedback(feedbackData).subscribe({
        next: (response: any) => {
          this.toastrNotification.showSuccess('Feedback ajouté avec succès');
          this.closeFeedbackModal();
          
          // Optionnel : recharger les entretiens pour voir les feedbacks mis à jour
          this.loadInterviews();
        },
        error: (error: any) => {
          console.error('Erreur lors de l\'ajout du feedback:', error);
          this.toastrNotification.showError('Erreur lors de l\'ajout du feedback');
        }
      });
    } else {
      this.toastrNotification.showWarning('Veuillez remplir tous les champs requis');
    }
  }

  /**
   * Télécharge un fichier via une requête HTTP authentifiée
   */
  private downloadFileAuthenticated(fileName: string, candidateName: string): void {
    const fileUrl = `${environment.apiUrl}/files/${fileName}/download`;
    
    this.cvService.downloadFile(fileUrl).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CV_${candidateName.replace(/\s+/g, '_')}.pdf`;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        this.toastrNotification.showSuccess('Téléchargement du CV démarré');
      },
      error: (error: any) => {
        console.error('Erreur lors du téléchargement du fichier:', error);
        if (error.status === 403) {
          this.toastrNotification.showUnauthorizedError();
        } else if (error.status === 404) {
          this.toastrNotification.showError('Fichier non trouvé');
        } else {
          this.toastrNotification.showError('Impossible de télécharger le fichier');
        }
      }
    });
  }

  /**
   * Vérifie si l'utilisateur peut visualiser les CV
   */
  canViewCV(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) {
      return false;
    }

    // Seuls les utilisateurs avec des rôles administratifs peuvent voir les CV
    return currentUser.roles.some((role: string) => 
      ['ROLE_ADMIN', 'ROLE_HR', 'ROLE_MANAGER', 'ROLE_TEAM_LEAD'].includes(role)
    );
  }

  // ======== MÉTHODES DE SÉLECTION ET ACTIONS GROUPÉES ========

  /**
   * Sélectionne tous les entretiens
   */
  selectAllInterviews(): void {
    this.selectedInterviews = new Set(this.filteredInterviews.map(i => i.id));
  }

  /**
   * Efface la sélection
   */
  clearSelection(): void {
    this.selectedInterviews.clear();
  }

  /**
   * Vérifie si un entretien est sélectionné
   */
  isInterviewSelected(interviewId: number): boolean {
    return this.selectedInterviews.has(interviewId);
  }

  /**
   * Bascule la sélection d'un entretien
   */
  toggleInterviewSelection(interviewId: number): void {
    if (this.selectedInterviews.has(interviewId)) {
      this.selectedInterviews.delete(interviewId);
    } else {
      this.selectedInterviews.add(interviewId);
    }
  }

  /**
   * Met à jour le statut en masse
   */
  bulkUpdateStatus(status: string): void {
    if (this.selectedInterviews.size === 0) {
      this.toastrNotification.showWarning('Aucun entretien sélectionné');
      return;
    }

    // Applique la même machine à états que les actions individuelles (canChangeStatus) :
    // sans ce filtre, un entretien COMPLETED (statut final) pourrait être repassé
    // en masse à IN_PROGRESS sans qu'aucune règle ne s'y oppose côté frontend ou backend.
    const ids = Array.from(this.selectedInterviews);
    const eligibleIds = ids.filter(id => {
      const interview = this.interviews.find(i => i.id === id);
      return !!interview && this.canChangeStatus(interview, status);
    });
    const ignoredCount = ids.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      this.toastrNotification.showWarning(
        `Aucun des entretiens sélectionnés ne peut passer au statut "${this.getStatusText(status)}" depuis son statut actuel`
      );
      return;
    }

    this.showConfirmationModal = true;
    this.confirmationMessage = `Êtes-vous sûr de vouloir changer le statut de ${eligibleIds.length} entretien(s) vers "${this.getStatusText(status)}" ?`
      + (ignoredCount > 0 ? ` (${ignoredCount} entretien(s) ignoré(s) car cette transition n'est pas autorisée depuis leur statut actuel)` : '');
    this.confirmationAction = () => {
      const requests = eligibleIds.map(id =>
        this.interviewService.updateInterviewStatus(id, status).pipe(
          catchError(error => {
            console.error(`Erreur lors de la mise à jour du statut de l'entretien #${id}:`, error);
            return of(null);
          })
        )
      );

      forkJoin(requests).subscribe(results => {
        const successCount = results.filter(r => r !== null).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          this.toastrNotification.showSuccess(`Statut mis à jour pour ${successCount} entretien(s)`);
        }
        if (failCount > 0) {
          this.toastrNotification.showError(`Échec de la mise à jour pour ${failCount} entretien(s)`);
        }

        this.selectedInterviews.clear();
        this.closeConfirmationModal();
        this.loadInterviews();
      });
    };
  }

  /**
   * Suppression en masse
   */
  bulkDelete(): void {
    if (this.selectedInterviews.size === 0) {
      this.toastrNotification.showWarning('Aucun entretien sélectionné');
      return;
    }

    this.showConfirmationModal = true;
    this.confirmationMessage = `Êtes-vous sûr de vouloir supprimer ${this.selectedInterviews.size} entretien(s) ? Cette action est irréversible.`;
    this.confirmationAction = () => {
      const ids = Array.from(this.selectedInterviews);
      const requests = ids.map(id =>
        this.interviewService.deleteInterview(id).pipe(
          catchError(error => {
            console.error(`Erreur lors de la suppression de l'entretien #${id}:`, error);
            return of(null);
          })
        )
      );

      forkJoin(requests).subscribe(results => {
        const successCount = results.filter(r => r !== null).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          this.toastrNotification.showSuccess(`${successCount} entretien(s) supprimé(s)`);
        }
        if (failCount > 0) {
          this.toastrNotification.showError(`Échec de la suppression pour ${failCount} entretien(s)`);
        }

        this.selectedInterviews.clear();
        this.closeConfirmationModal();
        this.loadInterviews();
      });
    };
  }

  // ======== MÉTHODES D'EXPORT ========

  /**
   * Export avancé des entretiens
   */
  exportInterviewsAdvanced(format: string): void {
    const dataToExport = this.selectedInterviews.size > 0 
      ? this.filteredInterviews.filter(i => this.selectedInterviews.has(i.id))
      : this.filteredInterviews;

    if (format === 'csv') {
      this.exportToCSV(dataToExport);
    } else if (format === 'excel') {
      this.exportToExcel(dataToExport);
    }
  }

  private exportToCSV(data: any[]): void {
    const csvContent = this.convertToCSV(data);
    this.downloadFile(csvContent, 'entretiens.csv', 'text/csv');
    this.toastrNotification.showSuccess('Export CSV téléchargé');
  }

  private exportToExcel(data: any[]): void {
    // Simulation d'export Excel
    console.log('Export Excel des données:', data);
    this.toastrNotification.showSuccess('Export Excel préparé');
  }

  private convertToCSV(data: any[]): string {
    const headers = ['ID', 'Candidat', 'Date', 'Type', 'Statut', 'Interviewer'];
    const rows = data.map(interview => [
      interview.id,
      interview.candidateName || 'N/A',
      this.formatDateTime(interview.interviewDate),
      this.getTypeText(interview.type),
      this.getStatusText(interview.status),
      interview.interviewer?.name || 'N/A'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ======== MÉTHODES DE FILTRAGE ========

  /**
   * Filtre rapide par statut
   */
  quickFilterByStatus(status: string): void {
    this.selectedStatus = status;
    this.filterInterviews();
  }

  /**
   * Efface tous les filtres
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedType = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.filterInterviews();
  }

  // ======== MÉTHODES DE FORMATAGE ========

  /**
   * Formate une date
   */
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  /**
   * Formate l'heure
   */
  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Formate la date et l'heure
   */
  formatDateTime(date: Date | string): string {
    return new Date(date).toLocaleString('fr-FR');
  }

  /**
   * Retourne l'icône pour le type d'entretien
   */
  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'PHONE_SCREENING': 'fas fa-phone',
      'TECHNICAL': 'fas fa-laptop-code',
      'HR': 'fas fa-user-tie',
      'MANAGER': 'fas fa-user-shield',
      'FINAL': 'fas fa-flag-checkered',
      'GROUP': 'fas fa-users'
    };
    return icons[type] || 'fas fa-question';
  }

  /**
   * Retourne le texte pour le type d'entretien
   */
  getTypeText(type: string): string {
    const types: { [key: string]: string } = {
      'PHONE_SCREENING': 'Entretien téléphonique',
      'TECHNICAL': 'Entretien technique',
      'HR': 'Entretien RH',
      'MANAGER': 'Entretien manager',
      'FINAL': 'Entretien final',
      'GROUP': 'Entretien de groupe'
    };
    return types[type] || type;
  }

  /**
   * Retourne la classe CSS pour le badge de statut
   */
  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'SCHEDULED': 'badge bg-warning text-dark',
      'IN_PROGRESS': 'badge bg-success',
      'COMPLETED': 'badge bg-primary',
      'CANCELLED': 'badge bg-danger',
      'RESCHEDULED': 'badge bg-info'
    };
    return classes[status] || 'badge bg-secondary';
  }

  /**
   * Retourne le texte pour le statut
   */
  getStatusText(status: string): string {
    const statuses: { [key: string]: string } = {
      'SCHEDULED': 'Planifié',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminé',
      'CANCELLED': 'Annulé',
      'RESCHEDULED': 'Reprogrammé'
    };
    return statuses[status] || status;
  }

  // ======== MÉTHODES DE GESTION DES CV ========

  /**
   * Télécharge un fichier depuis un blob
   */
  private downloadFileFromBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nettoie l'URL du blob
    window.URL.revokeObjectURL(url);
    this.toastrNotification.showSuccess('CV téléchargé avec succès');
  }

  /**
   * Vérifie si les boutons CV doivent être affichés
   */
  shouldShowCVButtons(interview: any): boolean {
    return interview?.candidateId != null && interview.candidateId > 0;
  }

  /**
   * Visualise le CV d'un candidat
   */
  viewCandidateCV(candidateId: number): void {
    this.toastrNotification.showInfo('Ouverture du CV...');
    
    this.cvService.getCVByCandidate(candidateId).subscribe({
      next: (cvResponse) => {
        if (cvResponse && (cvResponse.fileUrl || cvResponse.downloadUrl)) {
          const fileUrl = cvResponse.fileUrl || cvResponse.downloadUrl;
          
          if (fileUrl) {
            // Télécharge le fichier via le service authentifié, puis l'ouvre dans un nouvel onglet
            this.cvService.downloadFile(fileUrl).subscribe({
              next: (blob) => {
                // Crée une URL temporaire pour le blob et l'ouvre dans un nouvel onglet
                const blobUrl = window.URL.createObjectURL(blob);
                const newWindow = window.open(blobUrl, '_blank');
                
                if (newWindow) {
                  // Nettoie l'URL du blob après un délai pour éviter les fuites mémoire
                  setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                  }, 10000); // 10 secondes
                  
                  this.toastrNotification.showSuccess('CV ouvert dans un nouvel onglet');
                } else {
                  // Si le popup est bloqué, propose de télécharger à la place
                  this.toastrNotification.showWarning('Popup bloqué. Téléchargement du CV...');
                  this.downloadFileFromBlob(blob, cvResponse.originalFilename || 'cv.pdf');
                  window.URL.revokeObjectURL(blobUrl);
                }
              },
              error: (error) => {
                console.error('Erreur lors du téléchargement du fichier pour visualisation:', error);
                this.toastrNotification.showError('Erreur lors de l\'ouverture du CV');
              }
            });
          } else {
            this.toastrNotification.showError('URL du CV non disponible');
          }
        } else {
          this.toastrNotification.showError('URL du CV non disponible');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du CV:', error);
        this.toastrNotification.showError('Erreur lors de l\'ouverture du CV');
      }
    });
  }

  /**
   * Télécharge le CV d'un candidat
   */
  downloadCandidateCV(candidateId: number): void {
    this.toastrNotification.showInfo('Téléchargement du CV...');
    
    this.cvService.getCVByCandidate(candidateId).subscribe({
      next: (cvResponse) => {
        if (cvResponse && (cvResponse.fileUrl || cvResponse.downloadUrl)) {
          const fileUrl = cvResponse.fileUrl || cvResponse.downloadUrl;
          if (fileUrl) {
            this.downloadFileFromUrl(fileUrl, cvResponse.originalFilename || 'cv.pdf');
          } else {
            this.toastrNotification.showError('URL de téléchargement non disponible');
          }
        } else {
          this.toastrNotification.showError('URL de téléchargement non disponible');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du CV:', error);
        this.toastrNotification.showError('Erreur lors du téléchargement du CV');
      }
    });
  }

  /**
   * Télécharge un fichier depuis une URL
   */
  private downloadFileFromUrl(fileUrl: string, filename: string): void {
    this.cvService.downloadFile(fileUrl).subscribe({
      next: (blob) => {
        // Crée un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.toastrNotification.showSuccess('CV téléchargé avec succès');
      },
      error: (error) => {
        console.error('Erreur lors du téléchargement du fichier:', error);
        this.toastrNotification.showError('Erreur lors du téléchargement du fichier');
      }
    });
  }

  // ======== MÉTHODES DE GESTION DES MODALES ========

  /**
   * Ouvre la modale de consultation
   */
  openConsultationModal(interview: any): void {
    this.selectedInterview = interview;
    this.showConsultationModal = true;
  }

  /**
   * Ferme la modale de consultation
   */
  closeConsultationModal(): void {
    this.showConsultationModal = false;
    this.selectedInterview = null;
  }

  /**
   * Ouvre la modale de notification
   */
  openNotificationModal(interview: any): void {
    this.selectedInterview = interview;
    this.showNotificationModal = true;
  }

  /**
   * Ferme la modale de notification
   */
  closeNotificationModal(): void {
    this.showNotificationModal = false;
    this.selectedInterview = null;
    this.notificationForm.reset();
  }

  /**
   * Ferme la modale de confirmation
   */
  closeConfirmationModal(): void {
    this.showConfirmationModal = false;
    this.confirmationMessage = '';
    this.confirmationAction = null;
  }

  /**
   * Confirme l'action
   */
  confirmAction(): void {
    if (this.confirmationAction) {
      this.confirmationAction();
    }
  }

  // ======== MÉTHODES DE GESTION DES STATUTS ========

  /**
   * Vérifie si le statut peut être changé
   */
  canChangeStatus(interview: any, newStatus: string): boolean {
    const currentStatus = interview.status;
    
    // Logique de transition de statuts
    const allowedTransitions: { [key: string]: string[] } = {
      'SCHEDULED': ['IN_PROGRESS', 'CANCELLED', 'RESCHEDULED'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [], // Statut final
      'CANCELLED': ['RESCHEDULED'],
      'RESCHEDULED': ['SCHEDULED', 'CANCELLED']
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Démarre un entretien (SCHEDULED → IN_PROGRESS) puis ouvre la modale de
   * notification pour prévenir le candidat/l'interviewer.
   */
  confirmInterviewWithNotification(interview: any): void {
    this.interviewService.updateInterviewStatus(interview.id, 'IN_PROGRESS').subscribe({
      next: (updated) => {
        interview.status = updated.status;
        this.toastrNotification.showSuccess('Entretien marqué comme en cours');
        this.selectedInterview = interview;
        this.openNotificationModal(interview);
      },
      error: (error: any) => {
        console.error('Erreur lors du démarrage de l\'entretien:', error);
        this.toastrNotification.showError('Erreur lors du démarrage de l\'entretien');
      }
    });
  }

  /**
   * Termine un entretien (IN_PROGRESS → COMPLETED) puis ouvre la modale de feedback.
   */
  completeInterviewWithFeedback(interview: any): void {
    this.interviewService.updateInterviewStatus(interview.id, 'COMPLETED').subscribe({
      next: (updated) => {
        interview.status = updated.status;
        this.selectedInterview = interview;
        this.showFeedbackModal = true;
      },
      error: (error: any) => {
        console.error('Erreur lors de la finalisation de l\'entretien:', error);
        this.toastrNotification.showError('Erreur lors de la finalisation de l\'entretien');
      }
    });
  }

  /**
   * Reprogramme un entretien : marque le statut RESCHEDULED côté backend
   * (déclenche l'email de reprogrammation au candidat), puis ouvre le
   * formulaire de modification pour que l'admin fixe la nouvelle date.
   */
  rescheduleInterview(interview: any): void {
    this.interviewService.updateInterviewStatus(interview.id, 'RESCHEDULED').subscribe({
      next: (updated) => {
        interview.status = updated.status;
        this.toastrNotification.showSuccess('Entretien marqué comme reprogrammé, le candidat a été notifié. Renseignez la nouvelle date.');
        this.openInterviewModal(interview);
      },
      error: (error: any) => {
        console.error('Erreur lors de la reprogrammation de l\'entretien:', error);
        this.toastrNotification.showError('Erreur lors de la reprogrammation de l\'entretien');
      }
    });
  }

  /**
   * Annule un entretien : persiste le changement de statut côté backend
   * (déclenche l'email d'annulation au candidat et annule ses rappels).
   */
  cancelInterview(interview: any): void {
    this.showConfirmationModal = true;
    this.confirmationMessage = `Êtes-vous sûr de vouloir annuler l'entretien avec ${interview.candidateName} ?`;
    this.confirmationAction = () => {
      this.interviewService.updateInterviewStatus(interview.id, 'CANCELLED').subscribe({
        next: (updated) => {
          interview.status = updated.status;
          this.toastrNotification.showSuccess('Entretien annulé, le candidat a été notifié par e-mail');
          this.closeConfirmationModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de l\'annulation de l\'entretien:', error);
          this.toastrNotification.showError('Erreur lors de l\'annulation de l\'entretien');
          this.closeConfirmationModal();
        }
      });
    };
  }

  /**
   * Filtre les entretiens selon les critères
   */
  filterInterviews(): void {
    this.filteredInterviews = this.interviews.filter(interview => {
      // Filtre par terme de recherche
      if (this.searchTerm && this.searchTerm.trim()) {
        const searchLower = this.searchTerm.toLowerCase();
        const matchesSearch = 
          interview.candidateName?.toLowerCase().includes(searchLower) ||
          interview.type?.toLowerCase().includes(searchLower) ||
          interview.status?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Filtre par statut
      if (this.selectedStatus && interview.status !== this.selectedStatus) {
        return false;
      }

      // Filtre par type
      if (this.selectedType && interview.type !== this.selectedType) {
        return false;
      }

      // Filtre par date
      if (this.dateFrom || this.dateTo) {
        const interviewDate = new Date(interview.interviewDate);
        if (this.dateFrom && interviewDate < this.dateFrom) {
          return false;
        }
        if (this.dateTo && interviewDate > this.dateTo) {
          return false;
        }
      }

      return true;
    });

    // Mettre à jour le nombre total après filtrage
    this.totalInterviews = this.filteredInterviews.length;
    this.totalPages = Math.ceil(this.totalInterviews / this.pageSize);
  }

  /**
   * Pré-remplit le sujet et le message en fonction du type de notification choisi,
   * à partir des vraies informations de l'entretien sélectionné (candidat, offre,
   * date, lieu). L'admin reste libre de modifier le texte avant envoi.
   */
  onNotificationTypeChange(): void {
    if (!this.selectedInterview) return;

    const type = this.notificationForm.get('notificationType')?.value;
    const candidateName = this.selectedInterview.candidateName || 'Candidat';
    const jobTitle = this.selectedInterview.jobOfferTitle || 'le poste';
    const dateStr = this.formatDateTime(this.selectedInterview.interviewDate);
    const location = this.selectedInterview.location || 'lieu à préciser';

    const templates: { [key: string]: { subject: string; message: string } } = {
      INTERVIEW_CONFIRMATION: {
        subject: `Confirmation de votre entretien — ${jobTitle}`,
        message: `Bonjour ${candidateName},\n\nNous vous confirmons votre entretien pour le poste de ${jobTitle}, prévu le ${dateStr} (${location}).\n\nCordialement,\nL'équipe de recrutement`
      },
      INTERVIEW_REMINDER: {
        subject: `Rappel — Votre entretien approche`,
        message: `Bonjour ${candidateName},\n\nPetit rappel : votre entretien pour le poste de ${jobTitle} est prévu le ${dateStr} (${location}).\n\nCordialement,\nL'équipe de recrutement`
      },
      INTERVIEW_RESCHEDULED: {
        subject: `Reprogrammation de votre entretien`,
        message: `Bonjour ${candidateName},\n\nVotre entretien pour le poste de ${jobTitle} a été reprogrammé. Nouvelle date : ${dateStr} (${location}).\n\nCordialement,\nL'équipe de recrutement`
      },
      INTERVIEW_CANCELLED: {
        subject: `Annulation de votre entretien`,
        message: `Bonjour ${candidateName},\n\nNous vous informons que votre entretien du ${dateStr} pour le poste de ${jobTitle} est annulé. Nous reviendrons vers vous prochainement.\n\nCordialement,\nL'équipe de recrutement`
      },
      FEEDBACK_REQUEST: {
        subject: `Retour sur votre entretien`,
        message: `Bonjour ${candidateName},\n\nNous vous remercions pour votre entretien du ${dateStr} pour le poste de ${jobTitle}. Nous revenons vers vous prochainement avec un retour.\n\nCordialement,\nL'équipe de recrutement`
      }
    };

    const template = templates[type];
    if (template) {
      this.notificationForm.patchValue({ subject: template.subject, message: template.message });
    }
  }

  /**
   * Envoie la notification par email
   */
  sendNotification(): void {
    if (this.notificationForm.valid && this.selectedInterview) {
      const formData = this.notificationForm.value;

      const recipients: string[] = [];
      if (formData.sendToCandidate && this.selectedInterview.candidateEmail) {
        recipients.push(this.selectedInterview.candidateEmail);
      }
      if (formData.sendToInterviewer && this.selectedInterview.interviewerEmail) {
        recipients.push(this.selectedInterview.interviewerEmail);
      }
      if (formData.copyToHR) {
        const hrEmails = this.interviewers
          .filter(i => i.role === 'RH Manager' && !!i.email)
          .map(i => i.email);
        if (hrEmails.length === 0) {
          this.toastrNotification.showWarning('Aucun compte RH avec adresse e-mail trouvé pour la copie.');
        }
        hrEmails.forEach(email => {
          if (!recipients.includes(email)) {
            recipients.push(email);
          }
        });
      }

      if (recipients.length === 0) {
        this.toastrNotification.showWarning('Aucune adresse e-mail disponible pour les destinataires sélectionnés');
        return;
      }

      const requests = recipients.map(to =>
        this.notificationService.sendCustomEmail({
          to,
          subject: formData.subject,
          content: formData.message,
          isHtml: false
        }).pipe(
          catchError(error => {
            console.error(`Erreur lors de l'envoi de la notification à ${to}:`, error);
            return of(null);
          })
        )
      );

      forkJoin(requests).subscribe(results => {
        const successCount = results.filter(r => r !== null).length;
        if (successCount > 0) {
          this.toastrNotification.showSuccess(`Notification envoyée à ${successCount} destinataire(s)`);
        }
        if (successCount < results.length) {
          this.toastrNotification.showError(`Échec de l'envoi pour ${results.length - successCount} destinataire(s)`);
        }
        this.closeNotificationModal();
      });
    } else {
      this.toastrNotification.showError('Veuillez remplir tous les champs obligatoires');
    }
  }

  // ======== CALENDRIER PLANNING ========

  toggleCalendarView(): void {
    this.showCalendarView = !this.showCalendarView;
    if (this.showCalendarView) {
      this.buildCalendarDays();
    }
  }

  buildCalendarDays(): void {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start on Monday
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: { date: Date; interviews: Interview[] }[] = [];

    for (let i = 0; i < startOffset; i++) {
      days.push({ date: new Date(year, month, 1 - startOffset + i), interviews: [] });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dayInterviews = this.interviews.filter(iv => {
        const ivDate = new Date(iv.interviewDate);
        return ivDate.getFullYear() === year && ivDate.getMonth() === month && ivDate.getDate() === d;
      });
      days.push({ date, interviews: dayInterviews });
    }
    // Fill remaining cells to complete last row (multiple of 7)
    while (days.length % 7 !== 0) {
      days.push({ date: new Date(year, month + 1, days.length - lastDay.getDate() - startOffset + 1), interviews: [] });
    }
    this.calendarDays = days;
  }

  prevMonth(): void {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() - 1, 1);
    this.buildCalendarDays();
  }

  nextMonth(): void {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 1);
    this.buildCalendarDays();
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.calendarDate.getMonth();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  getCalendarMonthLabel(): string {
    return this.calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  getInterviewDotColor(status: string): string {
    switch (status) {
      case 'SCHEDULED': return '#f59e0b';
      case 'IN_PROGRESS': return '#3b82f6';
      case 'COMPLETED': return '#22c55e';
      case 'CANCELLED': return '#ef4444';
      case 'RESCHEDULED': return '#0ea5e9';
      default: return '#9ca3af';
    }
  }
}

