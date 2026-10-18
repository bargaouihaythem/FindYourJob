import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { JobOfferService } from '../../services/job-offer.service';
import { AuthService } from '../../services/auth';
import { CandidateService } from '../../services/candidate.service';
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
    private candidateService: CandidateService,
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
    this.loadMyApplicationStatuses();
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
    this.jobOfferService.getPublicJobOffers(this.currentPage, this.pageSize).subscribe({
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

  splitSkills(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
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
   * true si l'utilisateur connecté fait partie du personnel interne
   * (RH/Manager/Admin/équipe) — pour qui "Postuler" n'a pas de sens.
   */
  isStaffUser(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) {
      return false;
    }
    return currentUser.roles.includes('ROLE_ADMIN') ||
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
  }

  /**
   * Message informatif quand un visiteur non connecté ne peut pas postuler
   * (uniquement pertinent pour lui — le personnel interne ne voit pas ce bouton)
   */
  getApplyButtonMessage(): string {
    return 'Connectez-vous pour postuler';
  }

  /**
   * Statut du dossier du candidat connecté sur chaque offre, pour que la liste
   * ne propose plus « Postuler » sur une offre déjà traitée (cohérence liste/détail).
   */
  private applicationStatusByOffer = new Map<number, string>();

  loadMyApplicationStatuses(): void {
    if (!this.canApplyToJob()) return;
    const email = this.authService.getCurrentUser()?.email;
    if (!email) return;
    this.candidateService.getCandidatesByEmail(email).subscribe({
      next: (applications) => {
        this.applicationStatusByOffer.clear();
        applications.forEach(app => {
          if (app.jobOfferId != null && app.status) {
            this.applicationStatusByOffer.set(app.jobOfferId, app.status);
          }
        });
      },
      error: (err) => console.error('Chargement des candidatures du candidat impossible:', err)
    });
  }

  applicationStatusFor(job: JobOffer): string | null {
    return this.applicationStatusByOffer.get(job.id) ?? null;
  }

  /** Un dossier retiré n'empêche pas une nouvelle candidature. */
  canSubmitApplication(job: JobOffer): boolean {
    const status = this.applicationStatusFor(job);
    return this.canApplyToJob() && (status === null || status === 'WITHDRAWN');
  }

  /**
   * Libellé du bouton d'une offre. « Déjà postulé » et consorts ne s'affichent que si un
   * dossier existe réellement : sans dossier — ou si la chargement des candidatures a échoué —
   * le libellé reste « Postuler », sinon toutes les offres paraissent déjà postulées.
   */
  applicationBadgeFor(job: JobOffer): string {
    const status = this.applicationStatusFor(job);
    if (status === null) return 'Postuler';
    if (status === 'WITHDRAWN') return 'Postuler à nouveau';
    if (status === 'APPLIED') return 'Candidature en cours';
    if (status === 'CV_REVIEWED' || status === 'PHONE_SCREENING'
        || status === 'TECHNICAL_TEST' || status === 'INTERVIEW' || status === 'FINAL_INTERVIEW') {
      return 'Candidature en cours d\'examen';
    }
    if (status === 'REJECTED' || status === 'AUTO_REJECTED' || status === 'MANAGER_REJECTED') {
      return 'Candidature close';
    }
    if (status === 'ACCEPTED' || status === 'INTERVIEW_SCHEDULED' || status === 'HIRED') {
      return 'Candidature retenue';
    }
    return 'Candidature en cours';
  }
}

