import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { JobOfferService } from '../../../services/job-offer.service';
import { JobOffer, JobOfferRequest } from '../../../models/interfaces';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-job-offers-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './job-offers-admin.component.html',
  styleUrl: './job-offers-admin.component.scss'
})
export class JobOffersAdminComponent implements OnInit {
  jobOffers: JobOffer[] = [];
  filteredJobOffers: JobOffer[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalJobOffers = 0;
  totalPages = 0;
  
  // Filters
  searchForm: FormGroup;
  selectedStatus = '';
  selectedContractType = '';
  sortBy = 'createdAt';
  sortOrder = 'desc';
    // Modal states
  showJobOfferModal = false;
  showDeleteModal = false;
  selectedJobOffer: JobOffer | null = null;
  jobOfferForm: FormGroup;
  
  // Dropdown states
  openDropdownId: number | null = null;

  constructor(
    private jobOfferService: JobOfferService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      contractType: ['']
    });
      this.jobOfferForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      requiredSkills: ['', [Validators.required]],
      requirements: ['', [Validators.required]], // Ajout du contrôle requirements
      experienceLevel: ['', [Validators.required]],
      contractType: ['CDI', [Validators.required]],
      location: ['', [Validators.required]],
      salary: [''], // Ajout du contrôle salary
      salaryRange: [''],
      status: ['ACTIVE', [Validators.required]],
      deadline: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadJobOffers();
    this.setupSearchSubscription();
  }

  loadJobOffers(): void {
    this.loading = true;
    this.error = null;
    
    this.jobOfferService.getJobOffers().subscribe({
      next: (jobOffers: JobOffer[]) => {
        this.jobOffers = jobOffers;
        this.totalJobOffers = jobOffers.length;
        this.totalPages = Math.ceil(this.totalJobOffers / this.pageSize);
        this.applyFilters();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des offres d\'emploi:', error);
        this.error = 'Erreur lors du chargement des offres d\'emploi';
        this.loading = false;
      }
    });
  }

  setupSearchSubscription(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const { searchTerm, status, contractType } = this.searchForm.value;
    
    this.filteredJobOffers = this.jobOffers.filter(jobOffer => {
      const matchesSearch = !searchTerm || 
        jobOffer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobOffer.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobOffer.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !status || jobOffer.status === status;
      const matchesContractType = !contractType || jobOffer.contractType === contractType;
      
      return matchesSearch && matchesStatus && matchesContractType;
    });
    
    this.sortJobOffers();
    this.updatePagination();
  }

  sortJobOffers(): void {
    this.filteredJobOffers.sort((a, b) => {
      let aValue = a[this.sortBy as keyof JobOffer];
      let bValue = b[this.sortBy as keyof JobOffer];
      
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
    this.totalJobOffers = this.filteredJobOffers.length;
    this.totalPages = Math.ceil(this.totalJobOffers / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  getPaginatedJobOffers(): JobOffer[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredJobOffers.slice(startIndex, endIndex);
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

  openJobOfferModal(jobOffer?: JobOffer): void {
    this.selectedJobOffer = jobOffer || null;
    if (jobOffer) {
      // Log pour debug : afficher la donnée reçue
      console.log('JobOffer reçu pour édition:', jobOffer);
      this.jobOfferForm.patchValue({
        title: jobOffer.title || '',
        description: jobOffer.description || '',
        requiredSkills: jobOffer.requiredSkills || '',
        // requirements côté backend n'existe pas, on copie requiredSkills si besoin
        requirements: jobOffer.requirements || jobOffer.requiredSkills || '',
        experienceLevel: jobOffer.experienceLevel || '',
        contractType: jobOffer.contractType || 'CDI',
        location: jobOffer.location || '',
        // salary côté backend n'existe pas, on laisse vide ou on parse salaryRange si besoin
        salary: jobOffer.salary !== undefined && jobOffer.salary !== null && String(jobOffer.salary) !== '' ? Number(jobOffer.salary) : '',
        salaryRange: jobOffer.salaryRange || '',
        status: jobOffer.status || 'ACTIVE',
        deadline: jobOffer.deadline ? jobOffer.deadline.substring(0, 16) : '' // pour input type="datetime-local"
      });
    } else {
      this.jobOfferForm.reset();
      this.jobOfferForm.patchValue({ contractType: 'CDI', status: 'ACTIVE' });
    }
    this.showJobOfferModal = true;
  }

  closeJobOfferModal(): void {
    this.showJobOfferModal = false;
    this.selectedJobOffer = null;
    this.jobOfferForm.reset();
  }

  saveJobOffer(): void {
    if (this.jobOfferForm.valid) {
      const jobOfferData = this.jobOfferForm.value;
      // Adapter le format deadline si besoin (string -> Date)
      if (jobOfferData.deadline && typeof jobOfferData.deadline === 'string') {
        jobOfferData.deadline = new Date(jobOfferData.deadline);
      }
      if (this.selectedJobOffer) {
        // Mise à jour
        this.jobOfferService.updateJobOffer(this.selectedJobOffer.id, jobOfferData).subscribe({
          next: () => {
            this.toastr.success('Offre d\'emploi mise à jour avec succès !');
            this.loadJobOffers();
            this.closeJobOfferModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la mise à jour de l\'offre:', error);
            this.toastr.error('Erreur lors de la mise à jour de l\'offre');
          }
        });
      } else {
        // Création
        this.jobOfferService.createJobOffer(jobOfferData).subscribe({
          next: () => {
            this.toastr.success('Offre d\'emploi créée avec succès !');
            this.loadJobOffers();
            this.closeJobOfferModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la création de l\'offre:', error);
            this.toastr.error('Erreur lors de la création de l\'offre');
          }
        });
      }
    } else {
      this.toastr.error('Veuillez remplir tous les champs obligatoires');
    }
  }

  openDeleteModal(jobOffer: JobOffer): void {
    this.selectedJobOffer = jobOffer;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedJobOffer = null;
  }

  deleteJobOffer(): void {
    if (this.selectedJobOffer) {
      this.jobOfferService.deleteJobOffer(this.selectedJobOffer.id).subscribe({
        next: () => {
          this.toastr.success('Offre d\'emploi supprimée avec succès !');
          this.loadJobOffers();
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de l\'offre:', error);
          this.toastr.error('Erreur lors de la suppression de l\'offre');
        }
      });
    }
  }  updateJobOfferStatus(jobOffer: JobOffer, newStatus: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED'): void {
    // Ne rien faire si le statut est déjà le même
    if (jobOffer.status === newStatus) {
      this.closeAllDropdowns();
      this.toastr.info(`L'offre est déjà ${this.getStatusText(newStatus)}`);
      return;
    }
    
    console.log(`Tentative de changement de statut pour l'offre ${jobOffer.id}: ${jobOffer.status} -> ${newStatus}`);
    
    // Fermer le dropdown
    this.closeAllDropdowns();
    
    this.jobOfferService.updateJobOfferStatus(jobOffer.id, newStatus).subscribe({
      next: (response: any) => {
        console.log('Réponse API:', response);
        this.toastr.success(`Statut de l'offre mis à jour : ${this.getStatusText(newStatus)}`);
        jobOffer.status = newStatus;
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        console.error('Détails de l\'erreur:', error.error);
        
        // Gestion des erreurs spécifiques
        if (error.status === 400) {
          this.toastr.error('Statut invalide ou offre non trouvée');
        } else if (error.status === 403) {
          this.toastr.error('Vous n\'avez pas les droits pour modifier cette offre');
        } else if (error.status === 401) {
          this.toastr.error('Vous devez vous connecter pour modifier cette offre');
        } else {
          this.toastr.error(`Erreur lors de la mise à jour du statut: ${error.message || 'Erreur inconnue'}`);
        }
      }
    });
  }
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'badge bg-success';
      case 'DRAFT':
        return 'badge bg-warning';
      case 'CLOSED':
        return 'badge bg-danger';
      case 'EXPIRED':
        return 'badge bg-secondary';
      default:
        return 'badge bg-light text-dark';
    }
  }
  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'CLOSED':
        return 'Fermée';
      case 'DRAFT':
        return 'Brouillon';
      case 'EXPIRED':
        return 'Expirée';
      default:
        return status;
    }
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

  exportJobOffers(): void {
    const csvData = this.filteredJobOffers.map(jobOffer => ({
      'Titre': jobOffer.title,
      'Localisation': jobOffer.location,
      'Type de contrat': jobOffer.contractType,
      'Statut': this.getStatusText(jobOffer.status),
      'Salaire': jobOffer.salary ? `${jobOffer.salary}€` : 'Non spécifié',
      'Date de création': this.formatDate(jobOffer.createdAt),
      'Créé par': jobOffer.createdBy
    }));
    
    const csv = this.convertToCSV(csvData);
    this.downloadCSV(csv, 'offres-emploi.csv');
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
  // Méthodes pour gérer les dropdowns de statut
  toggleStatusDropdown(jobOfferId: number): void {
    console.log(`Toggle dropdown pour offre ${jobOfferId}`);
    this.openDropdownId = this.openDropdownId === jobOfferId ? null : jobOfferId;
  }
  
  closeAllDropdowns(): void {
    this.openDropdownId = null;
  }
  
  isDropdownOpen(jobOfferId: number): boolean {
    return this.openDropdownId === jobOfferId;
  }

  // Fermer les dropdowns en cliquant ailleurs
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.closeAllDropdowns();
    }
  }
}
