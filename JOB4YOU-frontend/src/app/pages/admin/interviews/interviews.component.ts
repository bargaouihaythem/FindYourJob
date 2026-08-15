import { environment } from "../../../../environments/environment";
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { InterviewService } from '../../../services/interview.service';
import { InterviewerService, Interviewer } from '../../../services/interviewer.service';
import { Interview } from '../../../models/interfaces';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
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
  jobOffers: any[] = [];
  interviewers: Interviewer[] = [];
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

  readonly Math = Math;

  constructor(
    private interviewService: InterviewService,
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private authService: AuthService,
    private feedbackService: FeedbackService,
    private cvService: CVService,
    private fb: FormBuilder,
    private toastrNotification: ToastrNotificationService,
    private notificationService: NotificationService,
    private http: HttpClient,
    private interviewerService: InterviewerService
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      type: [''],
      dateRange: ['']
    });
    
    this.interviewForm = this.fb.group({
      candidateId: ['', Validators.required],
      jobOfferId: ['', Validators.required],
      interviewerId: ['', Validators.required],
      interviewDate: ['', Validators.required],
      duration: [60, [Validators.required, Validators.min(15)]],
      location: ['', Validators.required],
      type: ['TECHNICAL', Validators.required],
      notes: [''],
      // Option A : planifier un entretien = pure logistique (agenda) et ne change PAS le statut.
      // Cette case (décochée par défaut) permet, par commodité, de faire aussi avancer le statut
      // du candidat à l'étape correspondante — via l'endpoint de statut, donc validé par le garde-fou.
      advanceStatus: [false]
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

  ngOnInit(): void {
    // Initialiser la propriété d'accès aux CVs
    this.userCanViewCV = this.canViewCV();
    
    this.loadInterviews();
    this.loadCandidates();
    this.loadJobOffers();
    this.loadInterviewers();
    this.setupSearchSubscription();
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

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (candidates: any[]) => {
        this.candidates = candidates;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    });
  }

  loadJobOffers(): void {
    this.jobOfferService.getJobOffers().subscribe({
      next: (jobOffers: any[]) => {
        this.jobOffers = jobOffers;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des offres d\'emploi:', error);
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
      }
    });
  }

  setupSearchSubscription(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
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
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fas fa-sort';
    return this.sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  openInterviewModal(interview?: Interview): void {
    this.selectedInterview = interview || null;
    
    if (interview) {
      const scheduledDate = new Date(interview.interviewDate);
      const formattedDate = scheduledDate.toISOString().slice(0, 16);
      
      this.interviewForm.patchValue({
        candidateId: interview.candidateId,
        interviewerId: interview.interviewerId,
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
    }
    
    this.showInterviewModal = true;
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
          next: () => {
            this.toastrNotification.showInterviewCreatedSuccess();
            // Commodité optionnelle : avancer aussi le statut du candidat (garde-fouté côté backend)
            if (interviewData.advanceStatus) {
              this.advanceCandidateStatusForType(candidateId, interviewData.type);
            }
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
   * Fait avancer le statut du candidat à l'étape correspondant au type d'entretien planifié.
   * Passe par l'endpoint de statut (donc validé par la machine à états côté backend) : une
   * transition non autorisée renvoie un 400 affiché comme avertissement, sans bloquer la
   * planification déjà effectuée.
   */
  private advanceCandidateStatusForType(candidateId: number, type: string): void {
    const target = this.mapInterviewTypeToStatus(type);
    if (!target) { return; }
    this.candidateService.updateCandidateStatus(candidateId, target).subscribe({
      next: () => this.toastrNotification.showSuccess('Statut du candidat avancé à l\'étape correspondante.', 'Statut mis à jour'),
      error: (err: any) => {
        const msg = err?.error?.message || 'Le statut n\'a pas pu être avancé (transition non autorisée par le workflow).';
        this.toastrNotification.showWarning(msg);
      }
    });
  }

  /** Étape de statut candidat correspondant à un type d'entretien (cf. machine à états). */
  private mapInterviewTypeToStatus(type: string): string | null {
    switch (type) {
      case 'PHONE_SCREENING': return 'PHONE_SCREENING';
      case 'TECHNICAL': return 'TECHNICAL_TEST';
      case 'HR':
      case 'MANAGER':
      case 'GROUP': return 'INTERVIEW';
      case 'FINAL': return 'FINAL_INTERVIEW';
      default: return null;
    }
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

