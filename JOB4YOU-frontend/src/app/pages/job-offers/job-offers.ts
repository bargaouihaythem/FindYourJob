import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
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
    private fb: FormBuilder,
    private route: ActivatedRoute
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
    this.handleUrlParams();
  }

  handleUrlParams(): void {
    // Vérifier les paramètres de recherche depuis l'URL (depuis la page d'accueil)
    this.route.queryParams.subscribe(params => {
      if (params['keyword'] || params['location']) {
        this.searchForm.patchValue({
          keyword: params['keyword'] || '',
          location: params['location'] || ''
        });
        
        // Filtrer automatiquement si des paramètres sont présents
        setTimeout(() => {
          this.filterJobs();
        }, 100);
        
        console.log('Paramètres de recherche depuis URL:', params);
      }
    });
  }

  setupSearchForm(): void {
    // Filtrer automatiquement à chaque changement avec un délai
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

    // Filter by keyword (local)
    if (formValue.keyword && formValue.keyword.trim()) {
      const keyword = formValue.keyword.toLowerCase().trim();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(keyword) ||
        job.description.toLowerCase().includes(keyword) ||
        job.requiredSkills.toLowerCase().includes(keyword)
      );
    }

    // Filter by location (local) - recherche EXACTE pour éviter les faux positifs
    if (formValue.location && formValue.location.trim()) {
      const location = formValue.location.toLowerCase().trim();
      filtered = filtered.filter(job => {
        const jobLocation = job.location.toLowerCase();
        
        // Recherche exacte stricte pour éviter que "Nice" trouve "Venice" ou autres
        return jobLocation.includes(location) && (
          jobLocation.startsWith(location) ||           // Commence par la ville
          jobLocation.includes(` ${location}`) ||       // Après un espace
          jobLocation.includes(`(${location}`) ||       // Dans des parenthèses
          jobLocation.includes(`,${location}`) ||       // Après une virgule
          jobLocation.includes(`-${location}`) ||       // Après un tiret
          jobLocation === location                      // Exactement égal
        );
      });
    }

    // Filter by contract type (local)
    if (formValue.contractType && formValue.contractType.trim()) {
      filtered = filtered.filter(job => 
        job.contractType === formValue.contractType
      );
    }

    this.filteredJobs = filtered;
    console.log(`Filtrage local: ${filtered.length} offres trouvées sur ${this.jobOffers.length} total`);
    console.log('Filtres appliqués:', formValue);
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
    this.error = '';
    this.filteredJobs = [...this.jobOffers]; // Afficher toutes les offres immédiatement
    console.log('Filtres effacés - affichage de toutes les offres');
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

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadJobOffers();
  }

  /**
   * Vérifie si l'utilisateur peut postuler à une offre d'emploi
   * Seuls les utilisateurs connectés avec un compte valide peuvent postuler
   */
  canApplyToJob(): boolean {
    // L'utilisateur DOIT être connecté pour postuler
    if (!this.authService.isAuthenticated()) {
      return false;
    }

    // Si l'utilisateur est connecté, vérifier qu'il a le rôle USER/CANDIDATE et aucun rôle administratif
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.roles) {
      // L'utilisateur peut postuler s'il a le rôle USER et aucun rôle administratif
      const hasUserRole = currentUser.roles.includes('ROLE_USER') || currentUser.roles.includes('USER');
      const hasAdminRole = currentUser.roles.includes('ROLE_ADMIN') ||
                          currentUser.roles.includes('ROLE_HR') ||
                          currentUser.roles.includes('ROLE_MANAGER') ||
                          currentUser.roles.includes('ROLE_TEAM_LEAD') ||
                          currentUser.roles.includes('ROLE_SENIOR_DEV') ||
                          currentUser.roles.includes('ROLE_TEAM') ||
                          currentUser.roles.includes('ADMIN') ||
                          currentUser.roles.includes('HR') ||
                          currentUser.roles.includes('MANAGER') ||
                          currentUser.roles.includes('TEAM_LEAD') ||
                          currentUser.roles.includes('SENIOR_DEV') ||
                          currentUser.roles.includes('TEAM');
      
      return hasUserRole && !hasAdminRole;
    }

    return false;
  }

  /**
   * Retourne le message à afficher quand l'utilisateur ne peut pas postuler
   */
  getApplyButtonMessage(): string {
    if (!this.authService.isAuthenticated()) {
      return 'Connectez-vous pour postuler';
    }
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.roles) {
      const hasAdminRole = currentUser.roles.includes('ROLE_ADMIN') ||
                          currentUser.roles.includes('ROLE_HR') ||
                          currentUser.roles.includes('ROLE_MANAGER') ||
                          currentUser.roles.includes('ROLE_TEAM_LEAD') ||
                          currentUser.roles.includes('ROLE_SENIOR_DEV') ||
                          currentUser.roles.includes('ROLE_TEAM') ||
                          currentUser.roles.includes('ADMIN') ||
                          currentUser.roles.includes('HR') ||
                          currentUser.roles.includes('MANAGER') ||
                          currentUser.roles.includes('TEAM_LEAD') ||
                          currentUser.roles.includes('SENIOR_DEV') ||
                          currentUser.roles.includes('TEAM');
      
      if (hasAdminRole) {
        return 'Les administrateurs ne peuvent pas postuler';
      }
    }
    
    return 'Postuler';
  }
}

