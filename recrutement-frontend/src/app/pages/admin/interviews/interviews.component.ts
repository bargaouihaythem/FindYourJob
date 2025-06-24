import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InterviewService } from '../../../services/interview.service';
import { Interview, InterviewRequest } from '../../../models/interfaces';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { AuthService } from '../../../services/auth';
import { FeedbackService } from '../../../services/feedback.service';
import { CVService } from '../../../services/cv.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-interviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './interviews.component.html'
})
export class InterviewsComponent implements OnInit {
  interviews: Interview[] = [];
  filteredInterviews: Interview[] = [];
  candidates: any[] = [];
  jobOffers: any[] = [];
  interviewers: any[] = [];
  loading = true;
  error: string | null = null;
  
  // Propriété pour le contrôle d'accès aux CVs
  userCanViewCV = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalInterviews = 0;
  totalPages = 0;
  
  // Filters
  searchForm: FormGroup;
  selectedStatus = '';
  selectedType = '';
  selectedDateRange = '';
  sortBy = 'interviewDate';
  sortOrder = 'asc';
  
  // Modal states
  showInterviewModal = false;
  showDeleteModal = false;
  showFeedbackModal = false;
  showConsultationModal = false;
  showNotificationModal = false;
  selectedInterview: Interview | null = null;
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

  constructor(
    private interviewService: InterviewService,
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private authService: AuthService,
    private feedbackService: FeedbackService,
    private cvService: CVService,
    private fb: FormBuilder,
    private toastr: ToastrService
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
      type: ['VIDEO', Validators.required],
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

  ngOnInit(): void {
    // Initialiser la propriété d'accès aux CVs
    this.userCanViewCV = this.canViewCV();
    console.log('Debug ngOnInit - userCanViewCV:', this.userCanViewCV);
    
    this.loadInterviews();
    this.loadCandidates();
    this.loadJobOffers();
    this.loadInterviewers();
    this.setupSearchSubscription();
    
    // Debug pour vérifier canViewCV au chargement
    console.log('Debug ngOnInit - canViewCV:', this.canViewCV());
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
        
        // Debug pour vérifier les données des entretiens
        console.log('Debug loadInterviews - interviews:', interviews);
        console.log('Debug loadInterviews - first interview candidateId:', interviews[0]?.candidateId);
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
    // Simuler la liste des interviewers (à adapter selon votre API)
    this.interviewers = [
      { id: 1, name: 'Jean Dupont', role: 'RH Manager' },
      { id: 2, name: 'Marie Martin', role: 'Tech Lead' },
      { id: 3, name: 'Pierre Durand', role: 'Senior Developer' }
    ];
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
        type: 'VIDEO',
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
        this.toastr.error('Tous les champs obligatoires doivent être remplis');
        return;
      }
      
      // Validation des IDs
      const candidateId = Number(interviewData.candidateId);
      const interviewerId = Number(interviewData.interviewerId);
      
      if (isNaN(candidateId) || candidateId <= 0) {
        this.toastr.error('ID du candidat invalide');
        return;
      }
      
      if (isNaN(interviewerId) || interviewerId <= 0) {
        this.toastr.error('ID de l\'interviewer invalide');
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
        type: this.mapTypeToBackend(interviewData.type),
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
            this.toastr.success('Entretien mis à jour avec succès !');
            this.loadInterviews();
            this.closeInterviewModal();
          },
          error: (error: any) => {
            console.error("Erreur lors de la mise à jour de l'entretien:", error);
            this.toastr.error("Erreur lors de la mise à jour de l'entretien");
            this.error = "Erreur lors de la mise à jour de l'entretien";
          }
        });
      } else {
        this.interviewService.createInterview(interviewToSend).subscribe({
          next: () => {
            this.toastr.success('Entretien créé avec succès !');
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
            
            this.toastr.error(errorMessage);
            this.error = errorMessage;
          }
        });
      }
    }
  }

  /**
   * Mappe le type d'entretien du frontend vers l'enum backend
   */
  private mapTypeToBackend(type: string): string {
    switch (type) {
      case 'VIDEO': return 'TECHNICAL';
      case 'PHONE': return 'PHONE_SCREENING';
      case 'IN_PERSON': return 'HR';
      default: return 'TECHNICAL';
    }
  }

  openDeleteModal(interview: Interview): void {
    this.selectedInterview = interview;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedInterview = null;
  }

  deleteInterview(): void {
    if (this.selectedInterview) {
      if (confirm('Êtes-vous sûr de vouloir supprimer cet entretien ?')) {
        this.interviewService.deleteInterview(this.selectedInterview.id).subscribe({
          next: () => {
            this.toastr.success('Entretien supprimé avec succès !');
            this.loadInterviews();
            this.closeDeleteModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la suppression de l\'entretien:', error);
            this.toastr.error('Erreur lors de la suppression de l\'entretien');
            this.error = 'Erreur lors de la suppression de l\'entretien';
          }
        });
      }
    }
  }

  openFeedbackModal(interview: Interview): void {
    this.selectedInterview = interview;
    this.feedbackForm.patchValue({
      feedback: '',
      rating: ''
    });
    this.showFeedbackModal = true;
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.selectedInterview = null;
    this.feedbackForm.reset();
  }

  saveFeedback(): void {
    if (this.feedbackForm.valid && this.selectedInterview) {
      const { feedback, rating } = this.feedbackForm.value;
      this.feedbackService.createFeedback({
        interviewId: this.selectedInterview.id,
        candidateId: this.selectedInterview.candidateId,
        comments: feedback,
        rating: rating ? parseInt(rating) : 0
      }).subscribe({
        next: () => {
          this.toastr.success('Feedback ajouté avec succès !');
          this.loadInterviews();
          this.closeFeedbackModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de l\'ajout du feedback:', error);
          this.toastr.error('Erreur lors de l\'ajout du feedback');
          this.error = 'Erreur lors de l\'ajout du feedback';
        }
      });
    }
  }

  /**
   * Ouvre le modal de consultation (visualisation) d'un entretien
   */
  openConsultationModal(interview: Interview): void {
    this.selectedInterview = interview;
    this.showConsultationModal = true;
  }

  closeConsultationModal(): void {
    this.showConsultationModal = false;
    this.selectedInterview = null;
  }

  /**
   * Ouvre le modal de notification pour envoyer des emails
   */
  openNotificationModal(interview: Interview): void {
    this.selectedInterview = interview;
    
    // Pré-remplir selon le type de notification
    const defaultSubject = this.getDefaultNotificationSubject(interview);
    const defaultMessage = this.getDefaultNotificationMessage(interview);
    
    this.notificationForm.patchValue({
      notificationType: 'INTERVIEW_CONFIRMATION',
      subject: defaultSubject,
      message: defaultMessage,
      sendToCandidate: true,
      sendToInterviewer: false,
      copyToHR: true
    });
    
    this.showNotificationModal = true;
  }

  closeNotificationModal(): void {
    this.showNotificationModal = false;
    this.selectedInterview = null;
    this.notificationForm.reset();
  }

  /**
   * Envoie une notification par email
   */
  sendNotification(): void {
    if (this.notificationForm.valid && this.selectedInterview) {
      const notificationData = {
        ...this.notificationForm.value,
        interviewId: this.selectedInterview.id,
        candidateId: this.selectedInterview.candidateId
      };

      // Simuler l'envoi de notification (à adapter selon votre API)
      console.log('Envoi de notification:', notificationData);
      
      // Appel à votre service de notification
      this.toastr.success('Notification envoyée avec succès !');
      this.closeNotificationModal();
    }
  }

  /**
   * Génère un sujet par défaut selon le type de notification
   */
  private getDefaultNotificationSubject(interview: Interview): string {
    const candidateName = interview.candidateName || 'Candidat';
    const jobTitle = interview.jobOfferTitle || 'Poste';
    
    return `Entretien - ${candidateName} - ${jobTitle}`;
  }

  /**
   * Génère un message par défaut selon le type de notification
   */
  private getDefaultNotificationMessage(interview: Interview): string {
    const candidateName = interview.candidateName || 'Candidat';
    const jobTitle = interview.jobOfferTitle || 'le poste';
    const dateStr = this.formatDateTime(interview.interviewDate);
    const location = interview.location || 'lieu à confirmer';
    
    return `Bonjour ${candidateName},

Nous vous confirmons votre entretien pour ${jobTitle}.

Détails :
- Date et heure : ${dateStr}
- Lieu : ${location}
- Durée : ${interview.durationMinutes || 60} minutes
- Type : ${this.getTypeText(interview.type)}

Cordialement,
L'équipe RH`;
  }

  /**
   * Confirme un entretien et envoie une notification
   */
  confirmInterviewWithNotification(interview: Interview): void {
    this.updateInterviewStatus(interview, 'IN_PROGRESS');
    
    // Envoyer automatiquement une notification de confirmation
    setTimeout(() => {
      this.openNotificationModal(interview);
      this.notificationForm.patchValue({
        notificationType: 'INTERVIEW_CONFIRMATION'
      });
    }, 500);
  }

  /**
   * Reprogramme un entretien
   */
  rescheduleInterview(interview: Interview): void {
    this.openInterviewModal(interview);
    // Marquer comme reprogrammé après modification
    this.selectedInterview = { ...interview, status: 'RESCHEDULED' as any };
  }

  /**
   * Termine un entretien et demande un feedback
   */
  completeInterviewWithFeedback(interview: Interview): void {
    this.updateInterviewStatus(interview, 'COMPLETED');
    
    // Ouvrir automatiquement le modal de feedback
    setTimeout(() => {
      this.openFeedbackModal(interview);
    }, 500);
  }

  /**
   * Exporte les entretiens avec plus d'options
   */
  exportInterviewsAdvanced(format: 'csv' | 'excel' = 'csv'): void {
    const csvData = this.filteredInterviews.map(interview => ({
      'ID': interview.id,
      'Candidat': interview.candidateName || 'N/A',
      'Email candidat': interview.candidateId ? `candidate_${interview.candidateId}@company.com` : 'N/A', // À adapter
      'Offre d\'emploi': interview.jobOfferTitle || 'N/A',
      'Interviewer': interview.interviewerName || 'N/A',
      'Date': this.formatDate(interview.interviewDate),
      'Heure': this.formatTime(interview.interviewDate),
      'Durée (min)': interview.durationMinutes || 'N/A',
      'Type': this.getTypeText(interview.type),
      'Lieu': interview.location || 'N/A',
      'Statut': this.getStatusText(interview.status),
      'Notes': interview.notes || 'N/A',
      'Créé le': new Date().toLocaleDateString('fr-FR')
    }));
    
    if (format === 'csv') {
      const csv = this.convertToCSV(csvData);
      this.downloadCSV(csv, `entretiens_${new Date().getTime()}.csv`);
    }
    
    this.toastr.success(`Export ${format.toUpperCase()} terminé !`);
  }

  /**
   * Filtre les entretiens par statut avec action rapide
   */
  quickFilterByStatus(status: string): void {
    this.searchForm.patchValue({ status });
    this.currentPage = 1;
  }

  /**
   * Actions en lot sur les entretiens sélectionnés
   */
  selectedInterviews: number[] = [];

  toggleInterviewSelection(interviewId: number): void {
    const index = this.selectedInterviews.indexOf(interviewId);
    if (index > -1) {
      this.selectedInterviews.splice(index, 1);
    } else {
      this.selectedInterviews.push(interviewId);
    }
  }

  isInterviewSelected(interviewId: number): boolean {
    return this.selectedInterviews.indexOf(interviewId) > -1;
  }

  selectAllInterviews(): void {
    this.selectedInterviews = this.getPaginatedInterviews().map(i => i.id);
  }

  clearSelection(): void {
    this.selectedInterviews = [];
  }

  /**
   * Actions en lot
   */
  bulkUpdateStatus(newStatus: 'IN_PROGRESS' | 'CANCELLED' | 'COMPLETED'): void {
    if (this.selectedInterviews.length === 0) {
      this.toastr.warning('Aucun entretien sélectionné');
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir mettre à jour ${this.selectedInterviews.length} entretien(s) ?`)) {
      // Appliquer le changement à tous les entretiens sélectionnés
      this.selectedInterviews.forEach(interviewId => {
        const interview = this.interviews.find(i => i.id === interviewId);
        if (interview) {
          this.updateInterviewStatus(interview, newStatus);
        }
      });
      
      this.clearSelection();
      this.toastr.success('Mise à jour en lot effectuée !');
    }
  }

  bulkDelete(): void {
    if (this.selectedInterviews.length === 0) {
      this.toastr.warning('Aucun entretien sélectionné');
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${this.selectedInterviews.length} entretien(s) ? Cette action est irréversible.`)) {
      // Supprimer tous les entretiens sélectionnés
      this.selectedInterviews.forEach(interviewId => {
        this.interviewService.deleteInterview(interviewId).subscribe({
          next: () => {
            this.interviews = this.interviews.filter(i => i.id !== interviewId);
          },
          error: (error) => {
            console.error('Erreur lors de la suppression:', error);
          }
        });
      });
      
      this.clearSelection();
      this.loadInterviews(); // Recharger la liste
      this.toastr.success('Suppression en lot effectuée !');
    }
  }

  // ===== MÉTHODES UTILITAIRES =====
  
  // Exposer Math pour le template
  Math = Math;

  updateInterviewStatus(interview: Interview, newStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'): void {
    this.interviewService.updateInterviewStatus(interview.id, newStatus).subscribe({
      next: () => {
        this.toastr.success('Statut de l\'entretien mis à jour avec succès !');
        interview.status = newStatus;
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        this.toastr.error('Erreur lors de la mise à jour du statut');
        this.error = 'Erreur lors de la mise à jour du statut';
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'badge bg-warning';
      case 'IN_PROGRESS': return 'badge bg-success';
      case 'COMPLETED': return 'badge bg-primary';
      case 'CANCELLED': return 'badge bg-danger';
      case 'RESCHEDULED': return 'badge bg-info';
      default: return 'badge bg-secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'Planifié';
      case 'IN_PROGRESS': return 'En cours';
      case 'COMPLETED': return 'Terminé';
      case 'CANCELLED': return 'Annulé';
      case 'RESCHEDULED': return 'Reprogrammé';
      default: return status;
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'PHONE_SCREENING': return 'fas fa-phone';
      case 'TECHNICAL': return 'fas fa-code';
      case 'HR': return 'fas fa-user-tie';
      case 'MANAGER': return 'fas fa-user-friends';
      case 'FINAL': return 'fas fa-handshake';
      case 'GROUP': return 'fas fa-users';
      default: return 'fas fa-calendar-alt';
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'PHONE_SCREENING': return 'Entretien téléphonique';
      case 'TECHNICAL': return 'Entretien technique';
      case 'HR': return 'Entretien RH';
      case 'MANAGER': return 'Entretien manager';
      case 'FINAL': return 'Entretien final';
      case 'GROUP': return 'Entretien de groupe';
      default: return type || 'Non défini';
    }
  }

  formatDate(date: Date | string | null): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | string | null): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(date: Date | string | null): string {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Heure invalide';
    
    return dateObj.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // ===== FONCTIONNALITÉS AJOUTÉES =====

  clearFilters(): void {
    this.searchForm.reset();
    this.currentPage = 1;
  }

  cancelInterview(interview: Interview): void {
    this.updateInterviewStatus(interview, 'CANCELLED');
  }

  // Ajouté pour le contrôle de workflow
  getCurrentUserRoles(): string[] {
    const user = this.authService.getCurrentUser();
    return user ? user.roles : [];
  }

  canChangeStatus(interview: Interview, newStatus: string): boolean {
    // Simplification pour éviter les erreurs - à adapter selon les besoins
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) return false;
    
    return this.interviewService.canChangeStatus(
      interview.status,
      newStatus,
      currentUser.roles
    );
  }

  // ===== CV MANAGEMENT =====

  /**
   * Vérifie si le candidat a un CV
   */
  candidateHasCV(candidateId: number): Promise<boolean> {
    return this.cvService.candidateHasCV(candidateId).toPromise()
      .then(hasCV => hasCV || false)
      .catch(() => false);
  }

  /**
   * Ouvre le CV du candidat dans un nouvel onglet
   */
  viewCandidateCV(candidateId: number): void {
    if (!candidateId) {
      this.toastr.error('ID candidat manquant');
      return;
    }
    
    this.cvService.getCVByCandidate(candidateId).subscribe({
      next: (cvResponse) => {
        // Utiliser storedFilename en priorité, puis originalFilename en fallback
        const fileName = cvResponse.storedFilename || cvResponse.originalFilename;
        
        if (cvResponse && fileName) {
          this.viewFileAuthenticated(fileName);
        } else {
          this.toastr.error('Aucun CV trouvé pour ce candidat');
        }
      },
      error: (error) => {
        console.error('Erreur lors de l\'ouverture du CV:', error);
        if (error.status === 403) {
          this.toastr.error('Vous n\'avez pas l\'autorisation d\'accéder à ce CV');
        } else if (error.status === 404) {
          this.toastr.error('Aucun CV trouvé pour ce candidat');
        } else {
          this.toastr.error('Impossible d\'ouvrir le CV du candidat');
        }
      }
    });
  }

  /**
   * Visualise un fichier via une requête HTTP authentifiée
   */
  private viewFileAuthenticated(fileName: string): void {
    const fileUrl = `http://localhost:8080/api/files/${fileName}`;
    
    this.cvService.getFileBlob(fileUrl).subscribe({
      next: (blob: Blob) => {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        this.toastr.success('CV ouvert dans un nouvel onglet');
        
        // Nettoyer l'URL après un délai
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération du fichier:', error);
        if (error.status === 403) {
          this.toastr.error('Vous n\'avez pas l\'autorisation d\'accéder à ce fichier');
        } else if (error.status === 404) {
          this.toastr.error('Fichier non trouvé');
        } else {
          this.toastr.error('Impossible d\'ouvrir le fichier');
        }
      }
    });
  }

  /**
   * Télécharge le CV du candidat
   */
  downloadCandidateCV(candidateId: number, candidateName: string): void {
    if (!candidateId) {
      this.toastr.error('ID candidat manquant');
      return;
    }
    
    this.cvService.getCVByCandidate(candidateId).subscribe({
      next: (cvResponse) => {        
        // Utiliser storedFilename en priorité, puis originalFilename en fallback
        const fileName = cvResponse.storedFilename || cvResponse.originalFilename;
        
        if (cvResponse && fileName) {
          this.downloadFileAuthenticated(fileName, candidateName);
        } else {
          this.toastr.error('Aucun CV trouvé pour ce candidat');
        }
      },
      error: (error: any) => {
        console.error('Erreur lors du téléchargement du CV:', error);
        if (error.status === 403) {
          this.toastr.error('Vous n\'avez pas l\'autorisation d\'accéder à ce CV');
        } else if (error.status === 404) {
          this.toastr.error('Aucun CV trouvé pour ce candidat');
        } else {
          this.toastr.error('Impossible de télécharger le CV du candidat');
        }
      }
    });
  }

  /**
   * Télécharge un fichier via une requête HTTP authentifiée
   */
  private downloadFileAuthenticated(fileName: string, candidateName: string): void {
    const fileUrl = `http://localhost:8080/api/files/${fileName}/download`;
    
    // Utiliser HttpClient avec l'intercepteur JWT pour télécharger le fichier
    this.cvService.downloadFile(fileUrl).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CV_${candidateName.replace(/\s+/g, '_')}.pdf`;
        link.click();
        
        // Nettoyer l'URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        this.toastr.success('Téléchargement du CV démarré');
      },
      error: (error: any) => {
        console.error('Erreur lors du téléchargement du fichier:', error);
        if (error.status === 403) {
          this.toastr.error('Vous n\'avez pas l\'autorisation de télécharger ce fichier');
        } else if (error.status === 404) {
          this.toastr.error('Fichier non trouvé');
        } else {
          this.toastr.error('Impossible de télécharger le fichier');
        }
      }
    });
  }

  /**
   * Vérifie si l'utilisateur actuel peut consulter les CVs
   */
  canViewCV(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) return false;
    
    return currentUser.roles.includes('RH') || 
           currentUser.roles.includes('MANAGER') || 
           currentUser.roles.includes('ÉQUIPE') ||
           currentUser.roles.includes('TEAM_LEAD') ||
           currentUser.roles.includes('SENIOR_DEV') ||
           currentUser.roles.includes('ROLE_HR') ||
           currentUser.roles.includes('ROLE_MANAGER') ||
           currentUser.roles.includes('ROLE_ÉQUIPE') ||
           currentUser.roles.includes('ROLE_TEAM_LEAD') ||
           currentUser.roles.includes('ROLE_SENIOR_DEV');
  }
}

