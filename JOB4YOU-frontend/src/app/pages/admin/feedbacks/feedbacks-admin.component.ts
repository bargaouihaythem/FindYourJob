import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FeedbackService } from '../../../services/feedback.service';
import { CandidateService } from '../../../services/candidate.service';
import { InterviewService } from '../../../services/interview.service';
import { NotificationService, FeedbackNotificationRequest } from '../../../services/notification.service';
import { Feedback, Interview } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

@Component({
  selector: 'app-feedbacks-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './feedbacks-admin.component.html',
  styleUrl: './feedbacks-admin.component.scss'
})
export class FeedbacksAdminComponent implements OnInit {
  feedbacks: Feedback[] = [];
  filteredFeedbacks: Feedback[] = [];
  pendingFeedbacks: Feedback[] = [];
  interviews: Interview[] = [];
  candidates: any[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalFeedbacks = 0;
  totalPages = 0;
  
  // Filters
  searchForm: FormGroup;
  selectedCandidate = '';
  selectedStatus = '';
  selectedRating = '';
  sortBy = 'createdAt';
  sortOrder = 'desc';
  
  // Modal states
  showFeedbackModal = false;
  showValidationModal = false;
  showDeleteModal = false;
  showViewModal = false;
  selectedFeedback: Feedback | null = null;
  feedbackForm: FormGroup;
  validationForm: FormGroup;

  // Tabs
  activeTab = 'all'; // 'all', 'pending', 'approved', 'rejected'

  constructor(
    private feedbackService: FeedbackService,
    private candidateService: CandidateService,
    private interviewService: InterviewService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private toastrNotification: ToastrNotificationService
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
      candidateId: [''],
      status: [''],
      rating: ['']
    });
    
    this.feedbackForm = this.fb.group({
      candidateId: ['', [Validators.required]],
      interviewId: [''],
      rating: ['', [Validators.required, Validators.min(1), Validators.max(5)]],
      content: ['', [Validators.required, Validators.minLength(10)]], // Correction ici
      type: ['', [Validators.required]] // Ajout du type obligatoire
    });

    this.validationForm = this.fb.group({
      decision: ['', [Validators.required]], // 'approve' or 'reject'
      content: ['', [Validators.required, Validators.minLength(5)]],
      nextSteps: [''],
      sendNotification: [true]
    });
  }

  ngOnInit(): void {
    this.loadFeedbacks();
    this.loadCandidates();
    this.loadInterviews();
    this.loadPendingFeedbacks();
    this.setupSearchSubscription();
  }

  loadFeedbacks(): void {
    this.loading = true;
    this.error = null;
    
    this.feedbackService.getFeedbacks().subscribe({
      next: (feedbacks: Feedback[]) => {
        this.feedbacks = feedbacks;
        this.totalFeedbacks = feedbacks.length;
        this.totalPages = Math.ceil(this.totalFeedbacks / this.pageSize);
        this.applyFilters();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des feedbacks:', error);
        this.error = 'Erreur lors du chargement des feedbacks';
        this.loading = false;
      }
    });
  }

  loadPendingFeedbacks(): void {
    this.feedbackService.getPendingFeedbacks().subscribe({
      next: (feedbacks: Feedback[]) => {
        this.pendingFeedbacks = feedbacks;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des feedbacks en attente:', error);
      }
    });
  }

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (candidates) => {
        this.candidates = candidates;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    });
  }

  loadInterviews(): void {
    this.interviewService.getInterviews().subscribe({
      next: (interviews) => {
        this.interviews = interviews;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des entretiens:', error);
      }
    });
  }

  setupSearchSubscription(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const { searchTerm, candidateId, status, rating } = this.searchForm.value;
    
    let baseList = this.feedbacks;
      // Filter by tab
    switch (this.activeTab) {
      case 'pending':
        baseList = this.feedbacks.filter(f => f.status === 'PENDING' || !f.status);
        break;
      case 'approved':
        baseList = this.feedbacks.filter(f => f.status === 'APPROVED');
        break;
      case 'rejected':
        baseList = this.feedbacks.filter(f => f.status === 'REJECTED');
        break;
      default:
        baseList = this.feedbacks;
    }
    
    this.filteredFeedbacks = baseList.filter(feedback => {
      const candidate = this.getCandidateName(feedback.candidateId);
      const matchesSearch = !searchTerm || 
        candidate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feedback.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCandidate = !candidateId || feedback.candidateId.toString() === candidateId;
      const matchesStatus = !status || feedback.status === status;
      const matchesRating = !rating || feedback.rating.toString() === rating;
      
      return matchesSearch && matchesCandidate && matchesStatus && matchesRating;
    });
    
    this.sortFeedbacks();
    this.updatePagination();
  }

  sortFeedbacks(): void {
    this.filteredFeedbacks.sort((a, b) => {
      let aValue = a[this.sortBy as keyof Feedback];
      let bValue = b[this.sortBy as keyof Feedback];
      
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      
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
    this.totalFeedbacks = this.filteredFeedbacks.length;
    this.totalPages = Math.ceil(this.totalFeedbacks / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  getPaginatedFeedbacks(): Feedback[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredFeedbacks.slice(startIndex, endIndex);
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

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.applyFilters();
  }
  openFeedbackModal(feedback?: Feedback): void {
    this.selectedFeedback = feedback || null;
    
    if (feedback) {
      this.feedbackForm.patchValue({
        candidateId: feedback.candidateId,
        interviewId: feedback.interviewId || '',
        rating: feedback.rating,
        content: feedback.content,
        type: feedback.type || 'GENERAL' // Ensure type is patched when editing with fallback
      });
    } else {
      this.feedbackForm.reset();
      // Set default values for new feedback
      this.feedbackForm.patchValue({
        type: 'GENERAL' // Default type for new feedback
      });
    }
    
    this.showFeedbackModal = true;
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.selectedFeedback = null;
    this.feedbackForm.reset();
  }

  saveFeedback(): void {
    if (this.feedbackForm.valid) {
      const feedbackData = this.feedbackForm.value;
      
      if (this.selectedFeedback) {
        // Mise à jour
        this.feedbackService.updateFeedback(this.selectedFeedback.id, feedbackData).subscribe({
          next: () => {
            this.toastrNotification.showFeedbackSentSuccess();
            this.loadFeedbacks();
            this.closeFeedbackModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la mise à jour du feedback:', error);
            this.toastrNotification.showFeedbackError();
          }
        });
      } else {
        // Création
        this.feedbackService.createFeedback(feedbackData).subscribe({
          next: () => {
            this.toastrNotification.showFeedbackSentSuccess();
            this.loadFeedbacks();
            this.loadPendingFeedbacks();
            this.closeFeedbackModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la création du feedback:', error);
            this.toastrNotification.showFeedbackError();
          }
        });
      }
    } else {
      this.toastrNotification.showValidationError('Veuillez remplir tous les champs obligatoires');
    }
  }

  openValidationModal(feedback: Feedback): void {
    this.selectedFeedback = feedback;
    this.validationForm.reset();
    this.validationForm.patchValue({ sendNotification: true });
    // Patch content for validation modal
    this.validationForm.patchValue({ content: '' });
    this.showValidationModal = true;
  }

  closeValidationModal(): void {
    this.showValidationModal = false;
    this.selectedFeedback = null;
    this.validationForm.reset();
  }

  validateFeedback(): void {
    if (this.validationForm.valid && this.selectedFeedback) {
      const { decision, content, nextSteps, sendNotification } = this.validationForm.value;
      const action = decision === 'approve' ? 
        this.feedbackService.approveFeedback(this.selectedFeedback.id) :
        this.feedbackService.rejectFeedback(this.selectedFeedback.id);
      action.subscribe({
        next: () => {
          const statusText = decision === 'approve' ? 'approuvé' : 'rejeté';
          this.toastrNotification.showSuccess(`Feedback ${statusText} avec succès !`);
          if (sendNotification) {
            this.sendFeedbackNotification(this.selectedFeedback!, decision, content, nextSteps);
          }
          this.loadFeedbacks();
          this.loadPendingFeedbacks();
          this.closeValidationModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de la validation du feedback:', error);
          this.toastrNotification.showError('Erreur lors de la validation du feedback');
        }
      });
    }
  }
  sendFeedbackNotification(feedback: Feedback, decision: string, content: string, nextSteps?: string): void {
    const notificationData: FeedbackNotificationRequest = {
      candidateId: feedback.candidateId,
      feedbackId: feedback.id,
      decision: decision,
      comments: content,
      nextSteps: nextSteps    };
    this.notificationService.sendDetailedFeedbackNotification(feedback.id, notificationData).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Notification envoyée au candidat');
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de la notification:', error);
        this.toastrNotification.showWarning('Feedback validé mais erreur lors de l\'envoi de la notification');
      }
    });
  }
  openDeleteModal(feedback: Feedback): void {
    this.selectedFeedback = feedback;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedFeedback = null;
  }

  // Modal de consultation (view)
  openViewModal(feedback: Feedback): void {
    this.selectedFeedback = feedback;
    this.showViewModal = true;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedFeedback = null;
  }

  // Correction de la fonction sendFeedbackNotification pour gérer les appels manuels
  sendManualNotification(feedback: Feedback): void {
    const notificationData: FeedbackNotificationRequest = {
      candidateId: feedback.candidateId,
      feedbackId: feedback.id,
      decision: feedback.status || 'PENDING',
      comments: 'Notification manuelle envoyée par l\'administrateur',      nextSteps: undefined
    };
    
    this.notificationService.sendDetailedFeedbackNotification(feedback.id, notificationData).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Notification envoyée au candidat avec succès !');
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de la notification:', error);
        this.toastrNotification.showError('Erreur lors de l\'envoi de la notification');
      }
    });
  }

  deleteFeedback(): void {
    if (this.selectedFeedback && this.selectedFeedback.id != null) {
      this.feedbackService.deleteFeedback(this.selectedFeedback.id).subscribe({
        next: () => {
          this.toastrNotification.showSuccess('Feedback supprimé avec succès !');
          this.loadFeedbacks();
          this.loadPendingFeedbacks();
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression du feedback:', error);
          this.toastrNotification.showError('Erreur lors de la suppression du feedback');
        }
      });
    } else {
      this.toastrNotification.showError('Aucun feedback sélectionné pour la suppression');
    }
  }

  getCandidateName(candidateId: number): string {
    const candidate = this.candidates.find(c => c.id === candidateId);
    return candidate ? `${candidate.firstName} ${candidate.lastName}` : `Candidat #${candidateId}`;
  }

  getInterviewInfo(interviewId?: number): string {
    if (!interviewId) return 'Aucun entretien associé';
    const interview = this.interviews.find(i => i.id === interviewId);
    return interview ? `Entretien du ${this.formatDate(interview.interviewDate)}` : `Entretien #${interviewId}`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'badge bg-warning text-dark';
      case 'APPROVED':
        return 'badge bg-success';
      case 'REJECTED':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'En attente';
      case 'APPROVED':
        return 'Approuvé';
      case 'REJECTED':
        return 'Rejeté';
      default:
        return status;
    }
  }

  getRatingStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  getRatingColor(rating: number): string {
    if (rating >= 4) return 'text-success';
    if (rating >= 3) return 'text-warning';
    return 'text-danger';
  }
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'Date non disponible';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Date invalide';
    }
    
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  clearFilters(): void {
    this.searchForm.reset();
    this.currentPage = 1;
  }
  exportFeedbacks(): void {
    try {
      const csvData = this.filteredFeedbacks.map(feedback => ({
        'Candidat': this.getCandidateName(feedback.candidateId),
        'Note': feedback.rating + '/5',
        'Type': this.getFeedbackTypeLabel(feedback.type || 'GENERAL'),
        'Commentaires': feedback.content,
        'Statut': this.getStatusText(feedback.status || 'PENDING'),
        'Entretien': this.getInterviewInfo(feedback.interviewId),
        'Date': this.formatDate(feedback.createdAt),
        'Créé par': feedback.createdBy || 'Inconnu'
      }));
      
      if (csvData.length === 0) {
        this.toastrNotification.showWarning('Aucun feedback à exporter');
        return;
      }
      
      const csv = this.convertToCSV(csvData);
      this.downloadCSV(csv, 'feedbacks.csv');
      this.toastrNotification.showSuccess('Export réalisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      this.toastrNotification.showError('Erreur lors de l\'export des feedbacks');
    }
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
  // Helper methods for feedback types and status
  getFeedbackTypes(): { value: string, label: string }[] {
    return [
      { value: 'INTERVIEW', label: 'Entretien' },
      { value: 'CV_REVIEW', label: 'Révision CV' },
      { value: 'TECHNICAL_TEST', label: 'Test technique' },
      { value: 'FINAL_DECISION', label: 'Décision finale' },
      { value: 'GENERAL', label: 'Général' }
    ];
  }

  getFeedbackTypeLabel(type: string): string {
    const typeMap: { [key: string]: string } = {
      'INTERVIEW': 'Entretien',
      'CV_REVIEW': 'Révision CV',
      'TECHNICAL_TEST': 'Test technique',
      'FINAL_DECISION': 'Décision finale',
      'GENERAL': 'Général'
    };
    return typeMap[type] || type;
  }

  // Méthodes d'envoi de notifications spécialisées
  sendCreationNotification(feedback: Feedback): void {
    const notificationData: FeedbackNotificationRequest = {
      candidateId: feedback.candidateId,
      feedbackId: feedback.id,
      decision: 'CREATED',
      comments: 'Un nouveau feedback a été créé pour votre candidature.',
      nextSteps: 'Votre feedback est en cours de traitement.'    };
    
    this.notificationService.sendDetailedFeedbackNotification(feedback.id, notificationData).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Notification de création envoyée au candidat');
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de la notification de création:', error);
        this.toastrNotification.showWarning('Feedback créé mais erreur lors de l\'envoi de la notification');
      }
    });
  }

  sendUpdateNotification(feedback: Feedback): void {
    const notificationData: FeedbackNotificationRequest = {
      candidateId: feedback.candidateId,
      feedbackId: feedback.id,
      decision: 'UPDATED',
      comments: 'Votre feedback a été mis à jour.',
      nextSteps: 'Vous pouvez consulter les dernières modifications.'    };
    
    this.notificationService.sendDetailedFeedbackNotification(feedback.id, notificationData).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Notification de mise à jour envoyée au candidat');
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de la notification de mise à jour:', error);
        this.toastrNotification.showWarning('Feedback mis à jour mais erreur lors de l\'envoi de la notification');
      }
    });
  }

  // Amélioration de la méthode saveFeedback avec option de notification
  saveFeedbackWithNotification(sendNotification: boolean = false): void {
    if (this.feedbackForm.valid) {
      const feedbackData = this.feedbackForm.value;
      
      if (this.selectedFeedback) {
        // Mise à jour
        this.feedbackService.updateFeedback(this.selectedFeedback.id, feedbackData).subscribe({
          next: (updatedFeedback) => {
            this.toastrNotification.showSuccess('Feedback mis à jour avec succès !');
            this.loadFeedbacks();
            this.closeFeedbackModal();
            
            if (sendNotification) {
              this.sendUpdateNotification(updatedFeedback || this.selectedFeedback!);
            }
          },
          error: (error: any) => {
            console.error('Erreur lors de la mise à jour du feedback:', error);
            this.toastrNotification.showError('Erreur lors de la mise à jour du feedback');
          }
        });
      } else {
        // Création
        this.feedbackService.createFeedback(feedbackData).subscribe({
          next: (newFeedback) => {
            this.toastrNotification.showSuccess('Feedback créé avec succès !');
            this.loadFeedbacks();
            this.loadPendingFeedbacks();
            this.closeFeedbackModal();
            
            if (sendNotification && newFeedback) {
              this.sendCreationNotification(newFeedback);
            }
          },
          error: (error: any) => {
            console.error('Erreur lors de la création du feedback:', error);
            this.toastrNotification.showError('Erreur lors de la création du feedback');
          }
        });
      }
    } else {
      this.toastrNotification.showError('Veuillez remplir tous les champs obligatoires');
    }
  }
}
