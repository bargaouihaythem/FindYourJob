import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { Candidate, JobOffer } from '../../../models/interfaces';
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

  // Email dropdown management
  openEmailDropdownId: number | null = null;

  // Visibilité de la liste : par défaut seuls les dossiers actifs (non clôturés) sont affichés.
  // 'rejected'  → uniquement REJECTED/AUTO_REJECTED/MANAGER_REJECTED
  // 'withdrawn' → uniquement WITHDRAWN (candidatures retirées, distinctes des rejets)
  // 'hired'     → uniquement HIRED (un candidat embauché n'est pas un candidat rejeté !)
  visibilityFilter: 'active' | 'rejected' | 'withdrawn' | 'hired' = 'active';

  // Auto-refresh
  private pollSubscription: Subscription | null = null;
  private readonly POLL_INTERVAL_MS = 30_000;
  isRefreshing = false;

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
    private authService: AuthService
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
  }

  ngOnInit(): void {
    this.isManagerView = this.authService.isManager() && !this.authService.isHR() && !this.authService.isAdmin();
    this.loadCandidates();
    this.loadJobOffers();
    this.setupSearchSubscription();
    this.startPolling();
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
        this.candidates = candidates;
        this.totalCandidates = candidates.length;
        this.totalPages = Math.ceil(this.totalCandidates / this.pageSize);
        this.applyFilters();
        this.isRefreshing = false;
      },
      error: () => { this.isRefreshing = false; }
    });
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
        this.totalCandidates = candidates.length;
        this.totalPages = Math.ceil(this.totalCandidates / this.pageSize);
        this.applyFilters();
        this.loading = false;
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

      const isRejectedFamily = candidate.status === 'REJECTED' || candidate.status === 'AUTO_REJECTED'
        || candidate.status === 'MANAGER_REJECTED';
      const isWithdrawn = candidate.status === 'WITHDRAWN';
      const isHired = candidate.status === 'HIRED';

      let matchesVisibility: boolean;
      if (this.visibilityFilter === 'rejected') {
        matchesVisibility = isRejectedFamily;
      } else if (this.visibilityFilter === 'withdrawn') {
        matchesVisibility = isWithdrawn;
      } else if (this.visibilityFilter === 'hired') {
        matchesVisibility = isHired;
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

  getRejectedCount(): number {
    return this.candidates.filter(c =>
      c.status === 'REJECTED' || c.status === 'AUTO_REJECTED' ||
      c.status === 'MANAGER_REJECTED'
    ).length;
  }

  getWithdrawnCount(): number {
    return this.candidates.filter(c => c.status === 'WITHDRAWN').length;
  }

  getHiredCount(): number {
    return this.candidates.filter(c => c.status === 'HIRED').length;
  }

  /** Statuts finaux — plus aucune modification possible */
  isStatusLocked(status: string): boolean {
    return status === 'ACCEPTED' || status === 'REJECTED' ||
           status === 'AUTO_REJECTED' || status === 'MANAGER_REJECTED' ||
           status === 'INTERVIEW_SCHEDULED' || status === 'HIRED' ||
           status === 'WITHDRAWN';
  }

  sortCandidates(): void {
    this.filteredCandidates.sort((a, b) => {
      let aValue = a[this.sortBy as keyof Candidate];
      let bValue = b[this.sortBy as keyof Candidate];
      
      // Gérer les valeurs undefined
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
    this.openStatusDropdownId = this.openStatusDropdownId === candidateId ? null : candidateId;
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
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCandidate = undefined;
    this.showScoreOverrideForm = false;
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
    const updatedData = { ...candidate, status: newStatus };
    this.candidateService.updateCandidateStatus(candidate.id, backendStatus).subscribe({
      next: () => {
        const t = this.statusChangeToast(backendStatus, candidate);
        this.toastrNotification.showSuccess(t.message, t.title);
        candidate.status = newStatus as Candidate['status'];
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
        this.toastrNotification.showCandidateError('Erreur lors de la mise à jour du statut');
        this.error = 'Erreur lors de la mise à jour du statut';
        // Fermer les dropdowns même en cas d'erreur
        this.openStatusDropdownId = null;
        this.openEmailDropdownId = null;
      }
    });
  }

  /**
   * Libellé lisible du manager destinataire selon la famille de métier de l'offre.
   * Reflète le routage automatique RH → manager (ManagerRoutingService côté backend).
   */
  private managerLabelForFamily(jobFamily?: string): string {
    switch (jobFamily) {
      case 'CS': return 'manager CS';
      case 'PRODOPS': return 'manager ProdOps / DevOps';
      case 'RSD': return 'manager R&D';
      default: return 'manager concerné';
    }
  }

  /**
   * Libellé du manager destinataire : on privilégie le département réel de l'offre
   * (routage organisationnel fin : CS, DevOps, ProdOps, R&D, QA...), et on retombe
   * sur la famille de métier pour les offres non rattachées à un département.
   */
  private managerLabel(candidate: Candidate): string {
    if (candidate.departmentName) {
      return `manager ${candidate.departmentName}`;
    }
    return this.managerLabelForFamily(candidate.jobFamily);
  }

  /**
   * Transitions de statut autorisées depuis le statut courant, côté RH/Admin.
   * Reflète la machine à états du chapitre 3 : progression linéaire des étapes
   * d'évaluation, décision finale (Accepter/Refuser) possible dès la validation RH,
   * et retrait toujours possible tant que le dossier n'est pas dans un état terminal.
   * kind : 'status' → updateCandidateStatus ; 'accept'/'reject' → managerDecision.
   */
  getAvailableTransitions(status: string): { key: string; label: string; icon: string; kind: 'status' | 'accept' | 'reject' }[] {
    const step = (key: string, label: string, icon: string) => ({ key, label, icon, kind: 'status' as const });
    const accept = { key: 'ACCEPT', label: 'Accepté', icon: 'fas fa-user-check text-success', kind: 'accept' as const };
    const reject = { key: 'REJECT', label: 'Rejeté', icon: 'fas fa-user-times text-danger', kind: 'reject' as const };
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
      default:
        return [];
    }
  }

  /** Applique la transition choisie dans la liste contextuelle. */
  onTransition(candidate: Candidate, t: { key: string; kind: 'status' | 'accept' | 'reject' }): void {
    if (t.kind === 'accept') { this.acceptCandidate(candidate); }
    else if (t.kind === 'reject') { this.rejectCandidate(candidate); }
    else { this.updateCandidateStatus(candidate, t.key); }
  }

  /**
   * Message de toast (vert) spécifique au nouveau statut, pour informer clairement
   * le RH/Admin de l'effet métier de son action — notamment le routage automatique
   * du dossier vers le manager compétent lors de la validation du CV.
   */
  private statusChangeToast(backendStatus: string, candidate: Candidate): { message: string; title: string } {
    switch (backendStatus) {
      case 'CV_REVIEWED':
        return {
          title: 'CV examiné',
          message: 'Le candidat est informé que son profil est présélectionné.'
        };
      case 'PHONE_SCREENING':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien téléphonique.' };
      case 'TECHNICAL_TEST':
        return {
          title: 'Transmis au manager',
          message: `Entretien téléphonique validé : le dossier a été transmis au ${this.managerLabel(candidate)} pour la phase technique.`
        };
      case 'INTERVIEW':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien.' };
      case 'FINAL_INTERVIEW':
        return { title: 'Statut modifié', message: 'Candidat placé en entretien final.' };
      case 'INTERVIEW_SCHEDULED':
        return { title: 'Entretien planifié', message: 'Entretien planifié pour ce candidat.' };
      case 'ACCEPTED':
        return { title: 'Candidat accepté', message: 'Candidature acceptée. Le candidat en est notifié par e-mail.' };
      case 'MANAGER_REJECTED':
      case 'REJECTED':
        return { title: 'Candidat refusé', message: 'Candidature refusée. Le candidat en est notifié par e-mail.' };
      case 'AUTO_REJECTED':
        return { title: 'Rejet automatique', message: 'Candidat rejeté (score IA insuffisant).' };
      case 'HIRED':
        return { title: 'Candidat embauché', message: 'Candidat embauché. Félicitations !' };
      case 'WITHDRAWN':
        return { title: 'Candidature retirée', message: 'La candidature a été marquée comme retirée.' };
      case 'APPLIED':
        return { title: 'Statut modifié', message: 'Candidat replacé au statut « Candidature soumise ».' };
      default:
        return { title: 'Statut modifié', message: 'Statut du candidat mis à jour avec succès !' };
    }
  }

  /**
   * Décision dédiée du manager (dossier déjà validé par le RH).
   * Utilise l'endpoint /manager-decision, restreint à ACCEPTED/REJECTED,
   * distinct du dropdown de statut générique réservé au RH/Admin.
   */
  acceptCandidate(candidate: Candidate): void {
    this.candidateService.managerDecision(candidate.id, 'ACCEPTED').subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Candidature acceptée avec succès !', 'Candidat accepté');
        candidate.status = 'ACCEPTED' as Candidate['status'];
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
    const reason = window.prompt('Motif obligatoire du rejet :');
    if (!reason?.trim()) {
      this.toastrNotification.showCandidateError('Le motif du rejet est obligatoire');
      return;
    }
    this.candidateService.managerDecision(candidate.id, 'REJECTED', reason.trim()).subscribe({
      next: () => {
        this.toastrNotification.showSuccess('Candidature refusée.', 'Candidat refusé');
        candidate.status = 'MANAGER_REJECTED' as Candidate['status'];
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

  formatDate(date: Date): string {
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
      'ACCEPTED': 'Accepté',
      'INTERVIEW_SCHEDULED': 'Entretien planifié',
      'HIRED': 'Embauché',
      'REJECTED': 'Rejeté',
      'AUTO_REJECTED': 'Rejeté (IA)',
      'MANAGER_REJECTED': 'Rejeté (manager)',
      'WITHDRAWN': 'Candidature retirée'
    };
    return statusLabels[status] || status;
  }

  openCV(url: string): void {
    window.open(url, '_blank');
  }
}

