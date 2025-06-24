import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { JobOfferService } from '../../../services/job-offer.service';
import { CVService } from '../../../services/cv.service';
import { NotificationService } from '../../../services/notification.service';
import { EmailComposerComponent } from '../../../components/email/email-composer.component';
import { Candidate, JobOffer } from '../../../models/interfaces';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, EmailComposerComponent],
  templateUrl: './candidates.component.html',
  styleUrl: './candidates.component.scss'
})
export class CandidatesComponent implements OnInit {
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
  
  // File upload
  selectedFile: File | null = null;
  
  // Status dropdown management
  openStatusDropdownId: number | null = null;
  
  // Email dropdown management
  openEmailDropdownId: number | null = null;

  constructor(
    private candidateService: CandidateService,
    private jobOfferService: JobOfferService,
    private cvService: CVService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private toastr: ToastrService
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
  }

  ngOnInit(): void {
    this.loadCandidates();
    this.loadJobOffers();
    this.setupSearchSubscription();
  }

  loadCandidates(): void {
    this.loading = true;
    this.error = null;
    
    this.candidateService.getCandidates().subscribe({
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
      
      return matchesSearch && matchesStatus && matchesJobOffer;
    });
    
    this.sortCandidates();
    this.updatePagination();
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
  toggleStatusDropdown(candidateId: number): void {
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
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCandidate = undefined;
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
      this.candidateForm.patchValue({ status: 'ACTIVE' });
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
          this.toastr.success('CV téléchargé avec succès !');
          this.loadCandidates(); // Rafraîchir la liste après upload
        },
        error: (error) => {
          console.error('Erreur lors du téléchargement du CV:', error);
          this.toastr.error('Erreur lors du téléchargement du CV. Veuillez réessayer.');
        }
      });
    }
  }

  downloadCV(candidate: Candidate): void {
    if (candidate.cv && candidate.cv.fileUrl) {
      window.open(candidate.cv.fileUrl, '_blank');
    } else {
      this.toastr.error('Aucun CV disponible pour ce candidat');
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
        this.toastr.error("Veuillez sélectionner une offre d'emploi.");
        return;
      }
      
      if (this.selectedCandidate) {
        // Mise à jour
        this.candidateService.updateCandidate(this.selectedCandidate.id, cleanData).subscribe({
          next: () => {
            this.toastr.success('Candidat mis à jour avec succès !');
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
            
            this.toastr.error(errorMessage);
            this.error = errorMessage;
          }
        });
      } else {
        // Création avec CV (FormData)
        if (this.selectedFile) {
          this.cvService.submitApplication(cleanData, this.selectedFile).subscribe({
            next: () => {
              this.toastr.success('Candidat créé avec succès !');
              this.loadCandidates();
              this.closeCandidateModal();
            },
            error: (error: any) => {
              console.error('Erreur lors de la création du candidat:', error);
              this.toastr.error('Erreur lors de la création du candidat');
              this.error = 'Erreur lors de la création du candidat';
            }
          });
        } else {
          this.toastr.error('Veuillez sélectionner un fichier CV.');
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
      if (confirm('Êtes-vous sûr de vouloir supprimer ce candidat ?')) {
        this.candidateService.deleteCandidate(this.selectedCandidate.id).subscribe({
          next: () => {
            this.toastr.success('Candidat supprimé avec succès !');
            this.loadCandidates();
            this.closeDeleteModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la suppression du candidat:', error);
            this.toastr.error('Erreur lors de la suppression du candidat');
            this.error = 'Erreur lors de la suppression du candidat';
          }
        });
      }
    }
  }

  updateCandidateStatus(candidate: Candidate, newStatus: string): void {
    const backendStatus = this.mapStatusToBackend(newStatus);
    const updatedData = { ...candidate, status: newStatus };
    this.candidateService.updateCandidateStatus(candidate.id, backendStatus).subscribe({
      next: () => {
        this.toastr.success('Statut du candidat mis à jour avec succès !');
        candidate.status = newStatus as Candidate['status'];
        // Fermer les dropdowns après la mise à jour
        this.openStatusDropdownId = null;
        this.openEmailDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        this.toastr.error('Erreur lors de la mise à jour du statut');
        this.error = 'Erreur lors de la mise à jour du statut';
        // Fermer les dropdowns même en cas d'erreur
        this.openStatusDropdownId = null;
        this.openEmailDropdownId = null;
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
      case 'INACTIVE':
        return 'WITHDRAWN';
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
        return 'badge bg-success';
      case 'REJECTED':
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
        this.toastr.success('Email de confirmation envoyé avec succès !');
        this.openEmailDropdownId = null;
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        this.toastr.error('Erreur lors de l\'envoi de l\'email');
        this.openEmailDropdownId = null;
      }
    });
  }

  sendInterviewInvitation(candidate: Candidate): void {
    // Cette méthode nécessiterait un ID d'entretien
    // Pour l'instant, on ouvre la modal de composition d'email
    this.openEmailModal(candidate);
    this.openEmailDropdownId = null;
  }

  sendFeedbackNotification(candidate: Candidate): void {
    // Cette méthode nécessiterait un ID de feedback
    // Pour l'instant, on ouvre la modal de composition d'email
    this.openEmailModal(candidate);
    this.openEmailDropdownId = null;
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
      'REJECTED': 'Rejeté',
      'WITHDRAWN': 'Candidature retirée'
    };
    return statusLabels[status] || status;
  }

  openCV(url: string): void {
    window.open(url, '_blank');
  }
}

