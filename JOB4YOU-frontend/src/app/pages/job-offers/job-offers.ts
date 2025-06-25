import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { JobOfferService } from '../../services/job-offer.service';
import { AuthService } from '../../services/auth';
import { JobOffer } from '../../models/interfaces';

@Component({
  selector: 'app-job-offers',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './job-offers.html',
  styleUrls: ['./job-offers.scss']
})
export class JobOffersComponent implements OnInit {
  jobOffers: JobOffer[] = [];
  filteredJobs: JobOffer[] = [];
  loading = true;
  error = '';
  searchForm: FormGroup;
  
  // Pagination
  currentPage = 0;
  pageSize = 9;
  totalJobs = 0;
  
  // Filters
  contractTypes = ['CDI', 'CDD', 'FREELANCE', 'INTERNSHIP', 'PART_TIME'];
  selectedContractType = '';
  selectedLocation = '';

  constructor(
    private jobOfferService: JobOfferService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.searchForm = this.fb.group({
      keyword: [''],
      location: [''],
      contractType: ['']
    });
  }

  ngOnInit(): void {
    this.loadJobOffers();
    this.setupSearchForm();
  }

  setupSearchForm(): void {
    this.searchForm.valueChanges.subscribe(() => {
      this.filterJobs();
    });
  }

  loadJobOffers(): void {
    this.loading = true;
    this.jobOfferService.getJobOffers(this.currentPage, this.pageSize).subscribe({
      next: (jobs: JobOffer[]) => {
        this.jobOffers = jobs;
        this.filteredJobs = jobs;
        this.totalJobs = jobs.length;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des offres:', error);
        this.error = 'Erreur lors du chargement des offres d\'emploi';
        this.loading = false;
      }
    });
  }

  filterJobs(): void {
    const formValue = this.searchForm.value;
    let filtered = [...this.jobOffers];

    // Filter by keyword
    if (formValue.keyword) {
      const keyword = formValue.keyword.toLowerCase();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(keyword) ||
        job.description.toLowerCase().includes(keyword) ||
        job.requirements.toLowerCase().includes(keyword)
      );
    }

    // Filter by location
    if (formValue.location) {
      const location = formValue.location.toLowerCase();
      filtered = filtered.filter(job => 
        job.location.toLowerCase().includes(location)
      );
    }

    // Filter by contract type
    if (formValue.contractType) {
      filtered = filtered.filter(job => 
        job.contractType === formValue.contractType
      );
    }

    this.filteredJobs = filtered;
  }

  getContractTypeLabel(contractType: string): string {
    const types: { [key: string]: string } = {
      'CDI': 'CDI',
      'CDD': 'CDD',
      'FREELANCE': 'Freelance',
      'INTERNSHIP': 'Stage',
      'PART_TIME': 'Temps partiel'
    };
    return types[contractType] || contractType;
  }

  formatSalary(salary: number | undefined): string {
    if (!salary) return 'Salaire non spécifié';
    return `${salary.toLocaleString('fr-FR')} €`;
  }

  clearFilters(): void {
    this.searchForm.reset();
    this.filteredJobs = [...this.jobOffers];
  }

  getDaysAgo(date: Date): number {
    const now = new Date();
    const jobDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - jobDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  loadMore(): void {
    this.currentPage++;
    this.jobOfferService.getPublicJobOffers(this.currentPage, this.pageSize).subscribe({
      next: (jobs) => {
        this.jobOffers = [...this.jobOffers, ...jobs];
        this.filterJobs();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des offres:', error);
        this.currentPage--; // Revert page increment on error
      }
    });
  }

  searchJobs(): void {
    const { keyword } = this.searchForm.value;
    if (keyword) {
      this.jobOfferService.searchJobOffers(keyword).subscribe({
        next: (jobs: JobOffer[]) => {
          this.filteredJobs = jobs;
          this.totalJobs = jobs.length;
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Erreur lors de la recherche des offres:', error);
          this.error = 'Erreur lors de la recherche des offres';
          this.loading = false;
        }
      });
    } else {
      this.filteredJobs = [...this.jobOffers];
      this.totalJobs = this.filteredJobs.length;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadJobOffers();
  }

  /**
   * Vérifie si l'utilisateur peut postuler à une offre d'emploi
   * Seuls les utilisateurs non connectés ou avec le rôle USER peuvent postuler
   */
  canApplyToJob(): boolean {
    // Si l'utilisateur n'est pas connecté, il peut postuler (candidature publique)
    if (!this.authService.isAuthenticated()) {
      return true;
    }

    // Si l'utilisateur est connecté, vérifier qu'il a seulement le rôle USER/CANDIDATE
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.roles) {
      // L'utilisateur peut postuler s'il a uniquement le rôle USER et aucun rôle administratif
      const hasOnlyUserRole = currentUser.roles.includes('ROLE_USER') && 
                              !currentUser.roles.includes('ROLE_ADMIN') &&
                              !currentUser.roles.includes('ROLE_HR') &&
                              !currentUser.roles.includes('ROLE_MANAGER') &&
                              !currentUser.roles.includes('ROLE_TEAM_LEAD') &&
                              !currentUser.roles.includes('ROLE_SENIOR_DEV') &&
                              !currentUser.roles.includes('ROLE_TEAM');
      return hasOnlyUserRole;
    }

    return false;
  }
}

