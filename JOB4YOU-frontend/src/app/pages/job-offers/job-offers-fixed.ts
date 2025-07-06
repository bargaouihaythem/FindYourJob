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
    // Ne pas filtrer automatiquement à chaque changement
    // L'utilisateur devra cliquer sur "Rechercher" pour déclencher le filtrage
    // this.searchForm.valueChanges.subscribe(() => {
    //   this.filterJobs();
    // });
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

    // Filter by location (local) - recherche plus précise
    if (formValue.location && formValue.location.trim()) {
      const location = formValue.location.toLowerCase().trim();
      filtered = filtered.filter(job => {
        const jobLocation = job.location.toLowerCase();
        // Recherche exacte d'abord, puis recherche partielle
        return jobLocation.includes(location) || 
               location.split(' ').some((word: string) => jobLocation.includes(word.trim()));
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
    this.loadJobOffers(); // Recharger toutes les offres
    console.log('Filtres effacés - rechargement de toutes les offres');
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
    this.loading = true;
    const formValue = this.searchForm.value;
    
    // Si aucun filtre n'est appliqué, recharger toutes les offres
    if (!formValue.keyword?.trim() && !formValue.location?.trim() && !formValue.contractType?.trim()) {
      this.loadJobOffers();
      return;
    }

    // Si une localisation est spécifiée, utiliser l'endpoint de recherche par localisation
    if (formValue.location?.trim()) {
      console.log(`Recherche par localisation: "${formValue.location}"`);
      this.jobOfferService.searchJobOffersByLocation(formValue.location.trim()).subscribe({
        next: (jobs: JobOffer[]) => {
          this.jobOffers = jobs;
          
          // Appliquer les autres filtres localement sur les résultats de localisation
          this.applyAdditionalFilters(jobs, formValue);
          
          this.totalJobs = this.filteredJobs.length;
          this.loading = false;
          console.log(`Recherche par localisation terminée: ${this.filteredJobs.length} offres trouvées`);
        },
        error: (error: any) => {
          console.error('Erreur lors de la recherche par localisation:', error);
          this.error = 'Erreur lors de la recherche par localisation';
          this.loading = false;
        }
      });
    }
    // Si seul un mot-clé est spécifié, utiliser l'endpoint de recherche par mot-clé
    else if (formValue.keyword?.trim()) {
      console.log(`Recherche par mot-clé: "${formValue.keyword}"`);
      this.jobOfferService.searchJobOffers(formValue.keyword.trim()).subscribe({
        next: (jobs: JobOffer[]) => {
          this.jobOffers = jobs;
          
          // Appliquer les autres filtres localement
          this.applyAdditionalFilters(jobs, formValue);
          
          this.totalJobs = this.filteredJobs.length;
          this.loading = false;
          console.log(`Recherche par mot-clé terminée: ${this.filteredJobs.length} offres trouvées`);
        },
        error: (error: any) => {
          console.error('Erreur lors de la recherche par mot-clé:', error);
          this.error = 'Erreur lors de la recherche par mot-clé';
          this.loading = false;
        }
      });
    }
    // Si seul le type de contrat est spécifié, filtrer localement
    else {
      this.filterJobs();
      this.loading = false;
    }
  }

  /**
   * Applique les filtres supplémentaires après une recherche backend
   */
  private applyAdditionalFilters(jobs: JobOffer[], formValue: any): void {
    let filtered = [...jobs];

    // Appliquer le filtre mot-clé si présent
    if (formValue.keyword?.trim()) {
      const keyword = formValue.keyword.toLowerCase().trim();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(keyword) ||
        job.description.toLowerCase().includes(keyword) ||
        job.requiredSkills.toLowerCase().includes(keyword)
      );
    }

    // Appliquer le filtre type de contrat si présent
    if (formValue.contractType?.trim()) {
      filtered = filtered.filter(job => 
        job.contractType === formValue.contractType
      );
    }

    this.filteredJobs = filtered;
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

  /**
   * Retourne le message approprié pour le bouton de candidature
   */
  getApplyButtonMessage(): string {
    if (!this.authService.isAuthenticated()) {
      return 'Connectez-vous pour postuler';
    }

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.roles) {
      const hasOnlyUserRole = currentUser.roles.includes('ROLE_USER') && 
                              !currentUser.roles.includes('ROLE_ADMIN') &&
                              !currentUser.roles.includes('ROLE_HR') &&
                              !currentUser.roles.includes('ROLE_MANAGER') &&
                              !currentUser.roles.includes('ROLE_TEAM_LEAD') &&
                              !currentUser.roles.includes('ROLE_SENIOR_DEV') &&
                              !currentUser.roles.includes('ROLE_TEAM');
      
      if (hasOnlyUserRole) {
        return 'Postuler';
      } else {
        return 'Accès réservé aux candidats';
      }
    }

    return 'Postuler';
  }
}
