import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { JobOfferService } from '../../../services/job-offer.service';
import { DepartmentService } from '../../../services/department.service';
import { DepartmentProposal, JobOffer, JobOfferRequest, Department, ManagerOption, RoutingPreview } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

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

  departments: Department[] = [];

  // Routage : managers désignables, destination résolue par le backend et
  // départements proposés pour une offre non rattachée (le RH confirme).
  managerOptions: ManagerOption[] = [];
  routingPreview: RoutingPreview | null = null;
  departmentProposals: DepartmentProposal[] = [];

  constructor(
    private jobOfferService: JobOfferService,
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private toastrNotification: ToastrNotificationService
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
      jobFamily: ['OTHER'],
      seniorityLevel: ['MID'],
      contractType: ['CDI', [Validators.required]],
      location: ['', [Validators.required]],
      salary: [''], // Ajout du contrôle salary
      salaryRange: [''],
      status: ['ACTIVE', [Validators.required]],
      deadline: ['', [Validators.required]],
      managerEmail: ['', [Validators.email]],
      departmentId: [''],
      hiringManagerId: [''],
      // Lâché tant que le RH n'a pas coché la case : transmission conditionnelle dans saveJobOffer()
      allowManagerDepartmentMismatch: ['']
    });
  }

  ngOnInit(): void {
    this.loadJobOffers();
    this.loadDepartments();
    this.setupSearchSubscription();
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (departments: Department[]) => this.departments = departments,
      error: (error: any) => console.error('Erreur lors du chargement des départements:', error)
    });
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
        jobFamily: jobOffer.jobFamily || 'OTHER',
        seniorityLevel: jobOffer.seniorityLevel || 'MID',
        contractType: jobOffer.contractType || 'CDI',
        location: jobOffer.location || '',
        // salary côté backend n'existe pas, on laisse vide ou on parse salaryRange si besoin
        salary: jobOffer.salary !== undefined && jobOffer.salary !== null && String(jobOffer.salary) !== '' ? Number(jobOffer.salary) : '',
        salaryRange: jobOffer.salaryRange || '',
        status: jobOffer.status || 'ACTIVE',
        deadline: jobOffer.deadline ? jobOffer.deadline.substring(0, 16) : '', // pour input type="datetime-local"
        managerEmail: jobOffer.managerEmail || '',
        departmentId: jobOffer.departmentId || '',
        hiringManagerId: jobOffer.hiringManagerId || ''
      });
      this.loadManagerOptions(jobOffer.departmentId);
      this.loadRoutingInfo();
    } else {
      this.jobOfferForm.reset();
      this.jobOfferForm.patchValue({ contractType: 'CDI', status: 'ACTIVE', jobFamily: 'OTHER', seniorityLevel: 'MID' });
      this.routingPreview = null;
      this.departmentProposals = [];
      this.loadManagerOptions(null);
    }
    this.showJobOfferModal = true;
  }

  closeJobOfferModal(): void {
    this.showJobOfferModal = false;
    this.selectedJobOffer = null;
    this.routingPreview = null;
    this.departmentProposals = [];
    this.jobOfferForm.reset();
  }

  /** Managers désignables, ceux du département choisi en tête (ordre renvoyé par le backend). */
  loadManagerOptions(departmentId: any): void {
    this.jobOfferService.getAssignableManagers(departmentId ? Number(departmentId) : null).subscribe({
      next: (options: ManagerOption[]) => this.managerOptions = options,
      error: () => this.managerOptions = []
    });
  }

  loadRoutingInfo(): void {
    const offer = this.selectedJobOffer;
    if (!offer) {
      this.routingPreview = null;
      this.departmentProposals = [];
      return;
    }
    this.jobOfferService.getRoutingPreview(offer.id).subscribe({
      next: (preview: RoutingPreview) => this.routingPreview = preview,
      error: () => this.routingPreview = null
    });
    if (offer.departmentId) {
      this.departmentProposals = [];
    } else {
      this.jobOfferService.getDepartmentProposals(offer.id).subscribe({
        next: (proposals: DepartmentProposal[]) => this.departmentProposals = proposals,
        error: () => this.departmentProposals = []
      });
    }
  }

  onDepartmentChange(): void {
    this.loadManagerOptions(this.jobOfferForm.get('departmentId')?.value);
    // Le département n'est plus vide : les propositions n'ont plus d'objet.
    this.departmentProposals = [];
  }

  onRoutingInputsChange(): void {
    this.loadRoutingInfo();
  }

  /** Le RH confirme la proposition : rien ne s'applique sans ce clic. */
  applyDepartmentProposal(proposal: DepartmentProposal): void {
    this.jobOfferForm.patchValue({ departmentId: proposal.departmentId });
    this.departmentProposals = [];
    this.onDepartmentChange();
  }

  managerDepartmentMismatch(): boolean {
    const managerId = Number(this.jobOfferForm.get('hiringManagerId')?.value || 0);
    const departmentId = Number(this.jobOfferForm.get('departmentId')?.value || 0);
    if (!managerId || !departmentId) return false;
    const manager = this.managerOptions.find(m => m.id === managerId);
    return !!manager?.departmentId && manager.departmentId !== departmentId;
  }

  /** Où partiront les dossiers de cette offre, annoncé avant l'enregistrement. */
  routingHint(): string {
    const managerId = Number(this.jobOfferForm.get('hiringManagerId')?.value || 0);
    if (managerId) {
      const manager = this.managerOptions.find(m => m.id === managerId);
      return manager
        ? `Destination après enregistrement : ${manager.fullName} (manager recruteur désigné)`
        : '';
    }
    const departmentId = Number(this.jobOfferForm.get('departmentId')?.value || 0);
    if (departmentId) {
      const department = this.departments.find(d => d.id === departmentId);
      const names = this.managerOptions
        .filter(m => m.departmentId === departmentId)
        .map(m => m.fullName);
      return names.length
        ? `Destination après enregistrement : ${names.join(', ')} (managers de ${department?.name ?? 'ce département'})`
        : `Le département ${department?.name ?? ''} ne compte aucun manager : désignez un manager recruteur, sinon la transmission sera refusée.`;
    }
    if (this.routingPreview?.managers?.length) {
      return `Destination actuelle : ${this.routingPreview.managers.map(m => m.fullName).join(', ')}`;
    }
    return 'Sans département ni manager recruteur, les dossiers partent aux managers de la famille de métier de l\'offre.';
  }

  saveJobOffer(): void {
    if (this.jobOfferForm.valid) {
      const jobOfferData = this.jobOfferForm.value;
      // Adapter le format deadline si besoin (string -> Date)
      if (jobOfferData.deadline && typeof jobOfferData.deadline === 'string') {
        jobOfferData.deadline = new Date(jobOfferData.deadline);
      }
      jobOfferData.departmentId = jobOfferData.departmentId ? Number(jobOfferData.departmentId) : null;
      jobOfferData.hiringManagerId = jobOfferData.hiringManagerId ? Number(jobOfferData.hiringManagerId) : null;
      // Le dépassement de département n'est envoyé que si le RH l'a expressément coché :
      // sans la case, le backend refuse un manager hors du département de l'offre.
      if (jobOfferData.allowManagerDepartmentMismatch === true) {
        jobOfferData.allowManagerDepartmentMismatch = true;
      } else {
        delete jobOfferData.allowManagerDepartmentMismatch;
      }
      if (this.selectedJobOffer) {
        // Mise à jour
        this.jobOfferService.updateJobOffer(this.selectedJobOffer.id, jobOfferData).subscribe({
          next: () => {
            this.toastrNotification.showJobOfferUpdatedSuccess();
            this.loadJobOffers();
            this.closeJobOfferModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la mise à jour de l\'offre:', error);
            this.toastrNotification.showJobOfferError(this.backendError(error, 'Erreur lors de la mise à jour de l\'offre'));
          }
        });
      } else {
        // Création
        this.jobOfferService.createJobOffer(jobOfferData).subscribe({
          next: () => {
            this.toastrNotification.showJobOfferCreatedSuccess();
            this.loadJobOffers();
            this.closeJobOfferModal();
          },
          error: (error: any) => {
            console.error('Erreur lors de la création de l\'offre:', error);
            this.toastrNotification.showJobOfferError(this.backendError(error, 'Erreur lors de la création de l\'offre'));
          }
        });
      }
    } else {
      this.toastrNotification.showValidationError('Veuillez remplir tous les champs obligatoires');
    }
  }

  /** Le backend explique un refus (rôle, département) : on affiche son message, pas un texte générique. */
  private backendError(error: any, fallback: string): string {
    return error?.error?.message || fallback;
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
          this.toastrNotification.showJobOfferDeletedSuccess();
          this.loadJobOffers();
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de l\'offre:', error);
          this.toastrNotification.showJobOfferError('Erreur lors de la suppression de l\'offre');
        }
      });
    }
  }  updateJobOfferStatus(jobOffer: JobOffer, newStatus: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED'): void {
    // Ne rien faire si le statut est déjà le même
    if (jobOffer.status === newStatus) {
      this.closeAllDropdowns();
      this.toastrNotification.showJobOfferAlreadyInStatus(this.getStatusText(newStatus));
      return;
    }
    
    console.log(`Tentative de changement de statut pour l'offre ${jobOffer.id}: ${jobOffer.status} -> ${newStatus}`);
    
    // Fermer le dropdown
    this.closeAllDropdowns();
    
    this.jobOfferService.updateJobOfferStatus(jobOffer.id, newStatus).subscribe({
      next: (response: any) => {
        console.log('Réponse API:', response);
        this.toastrNotification.showJobOfferStatusUpdatedSuccess(this.getStatusText(newStatus));
        jobOffer.status = newStatus;
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        console.error('Détails de l\'erreur:', error.error);
        
        // Gestion des erreurs spécifiques
        if (error.status === 400) {
          this.toastrNotification.showJobOfferError('Statut invalide ou offre non trouvée');
        } else if (error.status === 403) {
          this.toastrNotification.showUnauthorizedError();
        } else if (error.status === 401) {
          this.toastrNotification.showJobOfferError('Vous devez vous connecter pour modifier cette offre');
        } else {
          this.toastrNotification.showJobOfferError(`Erreur lors de la mise à jour du statut: ${error.message || 'Erreur inconnue'}`);
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
