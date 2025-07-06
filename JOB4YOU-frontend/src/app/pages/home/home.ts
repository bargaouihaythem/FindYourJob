import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { JobOfferService } from '../../services/job-offer.service';
import { AuthService } from '../../services/auth';
import { JobOffer, User } from '../../models/interfaces';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit {
  featuredJobs: JobOffer[] = [];
  loading = true;
  error = '';
  currentUser: User | null = null;
  searchForm: FormGroup;

  constructor(
    private jobOfferService: JobOfferService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    
    this.searchForm = this.fb.group({
      keyword: [''],
      location: ['']
    });
  }

  ngOnInit(): void {
    this.loadFeaturedJobs();
  }

  loadFeaturedJobs(): void {
    this.jobOfferService.getPublicJobOffers(0, 6).subscribe({
      next: (jobs: JobOffer[]) => {
        this.featuredJobs = jobs;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des offres:', error);
        this.error = 'Erreur lors du chargement des offres d\'emploi';
        this.loading = false;
      }
    });
  }

  onSearchSubmit(): void {
    const formValue = this.searchForm.value;
    
    // Naviguer vers la page des offres d'emploi avec les paramètres de recherche
    this.router.navigate(['/job-offers'], {
      queryParams: {
        keyword: formValue.keyword || null,
        location: formValue.location || null
      }
    });
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

  isAuthenticated(): boolean {
    const authenticated = this.authService.isAuthenticated();
    console.log('=== DEBUG isAuthenticated ===', authenticated);
    return authenticated;
  }

  isAdmin(): boolean {
    const admin = this.authService.isAdmin();
    console.log('=== DEBUG isAdmin ===', admin);
    return admin;
  }

  isHR(): boolean {
    const hr = this.authService.isHR();
    console.log('=== DEBUG isHR ===', hr);
    return hr;
  }

  isCandidate(): boolean {
    return this.isAuthenticated() && !this.isAdmin() && !this.isHR();
  }

  canApplyToJob(): boolean {
    // Logs de debug
    console.log('=== DEBUG canApplyToJob ===');
    console.log('isAuthenticated():', this.isAuthenticated());
    console.log('currentUser:', this.authService.getCurrentUser());
    
    // L'utilisateur DOIT être connecté pour postuler
    if (!this.isAuthenticated()) {
      console.log('User not authenticated - cannot apply');
      return false;
    }

    // Si l'utilisateur est connecté, vérifier qu'il a le rôle USER/CANDIDATE et aucun rôle administratif
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.roles) {
      console.log('User roles:', currentUser.roles);
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
      
      const canApply = hasUserRole && !hasAdminRole;
      console.log('canApply:', canApply);
      return canApply;
    }

    console.log('No roles found - cannot apply');
    return false;
  }
}

