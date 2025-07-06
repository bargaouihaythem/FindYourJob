import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { JobOfferService } from '../../services/job-offer.service';
import { CandidateService } from '../../services/candidate.service';
import { AuthService } from '../../services/auth';
import { JobOffer, Candidate } from '../../models/interfaces';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './job-detail.html',
  styleUrl: './job-detail.scss'
})
export class JobDetailComponent implements OnInit {
  job: JobOffer | null = null;
  loading = true;
  error: string | null = null;
  hasAlreadyApplied = false; // Nouvelle propriété pour tracker si l'utilisateur a déjà postulé
  
  // Application form
  applicationForm: FormGroup;
  selectedFile: File | null = null;
  submitting = false;
  applicationSuccess = false;
  applicationError: string | null = null;
  showApplicationModal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobOfferService: JobOfferService,
    private candidateService: CandidateService,
    private authService: AuthService,
    private formBuilder: FormBuilder
  ) {
    this.applicationForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      coverLetter: [''],
      cv: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loading = true;
      
      // Utiliser l'endpoint approprié selon l'état d'authentification
      const jobOfferObservable = this.authService.isAuthenticated() 
        ? this.jobOfferService.getJobOfferById(id)
        : this.jobOfferService.getPublicJobOfferById(id);
      
      jobOfferObservable.subscribe({
        next: (job: JobOffer) => {
          this.job = job;
          this.loading = false;
          
          // Pre-fill form if user is authenticated
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            this.applicationForm.patchValue({
              firstName: currentUser.firstName || '',
              lastName: currentUser.lastName || '',
              email: currentUser.email || ''
            });
            
            // Vérifier si l'utilisateur a déjà postulé pour cette offre
            this.checkIfAlreadyApplied(currentUser.email, job.id);
          }

          // Check if user came from application link (via referrer or query params)
          const fragment = this.route.snapshot.fragment;
          if (fragment === 'application-section') {
            // Automatically open modal if fragment is application-section
            setTimeout(() => this.openApplicationModal(), 500);
          }
        },
        error: (err) => {
          console.error('Erreur lors du chargement de l\'offre:', err);
          this.error = "Offre d'emploi introuvable ou inaccessible.";
          this.loading = false;
        }
      });
    } else {
      this.error = "Identifiant d'offre invalide.";
      this.loading = false;
    }
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Vérifie si l'utilisateur peut postuler à une offre d'emploi
   * Seuls les utilisateurs connectés avec le rôle USER peuvent postuler
   */
  canApplyToJob(): boolean {
    // L'utilisateur DOIT être connecté pour postuler
    if (!this.authService.isAuthenticated()) {
      return false;
    }

    // Vérifier si l'utilisateur a déjà postulé
    if (this.hasAlreadyApplied) {
      return false;
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
   * Vérifie si l'utilisateur connecté a déjà postulé pour cette offre
   */
  checkIfAlreadyApplied(email: string, jobOfferId: number): void {
    this.candidateService.getCandidatesByEmail(email).subscribe({
      next: (applications: Candidate[]) => {
        this.hasAlreadyApplied = applications.some((app: Candidate) => app.jobOfferId === jobOfferId);
        console.log('Vérification candidature existante:', {
          email: email,
          jobOfferId: jobOfferId,
          hasAlreadyApplied: this.hasAlreadyApplied,
          applicationsCount: applications.length
        });
      },
      error: (err: any) => {
        console.error('Erreur lors de la vérification des candidatures:', err);
        // En cas d'erreur, on assume que l'utilisateur n'a pas encore postulé
        this.hasAlreadyApplied = false;
      }
    });
  }

  scrollToApplication(): void {
    const element = document.getElementById('application-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Gère l'action de candidature selon l'état d'authentification
   */
  handleApplyAction(): void {
    if (this.authService.isAuthenticated()) {
      if (this.canApplyToJob()) {
        this.openApplicationModal();
      } else {
        this.applicationError = "Vous n'avez pas les permissions pour postuler à cette offre.";
      }
    } else {
      // Rediriger vers l'inscription avec retour sur cette page
      const currentUrl = this.router.url;
      this.router.navigate(['/register'], { 
        queryParams: { returnUrl: currentUrl }
      });
    }
  }

  /**
   * Vérifie si l'utilisateur doit être redirigé vers l'inscription
   */
  shouldRedirectToRegister(): boolean {
    return !this.authService.isAuthenticated();
  }

  openApplicationModal(): void {
    this.showApplicationModal = true;
    // Reset form state when opening modal
    this.applicationSuccess = false;
    this.applicationError = null;
    this.submitting = false;
  }

  closeApplicationModal(): void {
    this.showApplicationModal = false;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        this.applicationError = 'Seuls les fichiers PDF, DOC, et DOCX sont acceptés pour le CV.';
        this.selectedFile = null;
        this.applicationForm.get('cv')?.setErrors({ 'invalidType': true });
        return;
      }
      
      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.applicationError = 'La taille du fichier ne doit pas dépasser 5MB.';
        this.selectedFile = null;
        this.applicationForm.get('cv')?.setErrors({ 'tooLarge': true });
        return;
      }
      
      this.selectedFile = file;
      this.applicationError = null;
      // Marquer le champ CV comme valide
      this.applicationForm.get('cv')?.setErrors(null);
      this.applicationForm.get('cv')?.markAsTouched();
    } else {
      this.selectedFile = null;
      this.applicationForm.get('cv')?.setErrors({ 'required': true });
    }
  }

  submitApplication(): void {
    if (this.applicationForm.valid && this.selectedFile && this.job) {
      this.submitting = true;
      this.applicationError = null;

      // Créer l'objet ApplicationRequest
      const applicationData = {
        firstName: this.applicationForm.value.firstName,
        lastName: this.applicationForm.value.lastName,
        email: this.applicationForm.value.email,
        phone: this.applicationForm.value.phone,
        coverLetter: this.applicationForm.value.coverLetter || '',
        jobOfferId: this.job.id
      };

      const formData = new FormData();
      formData.append('application', JSON.stringify(applicationData));
      formData.append('cv', this.selectedFile);

      this.candidateService.createCandidate(formData).subscribe({
        next: (response) => {
          this.applicationSuccess = true;
          this.submitting = false;
          // Close modal after 3 seconds
          setTimeout(() => {
            this.closeApplicationModal();
          }, 3000);
        },
        error: (error) => {
          this.applicationError = error.error?.message || 'Une erreur est survenue lors de l\'envoi de votre candidature.';
          this.submitting = false;
        }
      });
    } else {
      this.markFormGroupTouched();
      if (!this.selectedFile) {
        this.applicationForm.get('cv')?.markAsTouched();
      }
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.applicationForm.controls).forEach(key => {
      const control = this.applicationForm.get(key);
      control?.markAsTouched();
    });
  }
}
