import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { LoginRequest } from '../../models/interfaces';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastrNotification: ToastrNotificationService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false] // Ajouter le contrôle pour "Se souvenir de moi"
    });

    // Pré-remplir le nom d'utilisateur si "Se souvenir de moi" était activé
    this.loadRememberedCredentials();
  }

  /**
   * Charge les informations sauvegardées si "Se souvenir de moi" était activé
   */
  private loadRememberedCredentials(): void {
    if (this.authService.isRememberMeEnabled()) {
      const rememberedUsername = this.authService.getRememberedUsername();
      if (rememberedUsername) {
        this.loginForm.patchValue({
          username: rememberedUsername,
          rememberMe: true
        });
        
        // Focus automatiquement sur le champ mot de passe si le username est pré-rempli
        setTimeout(() => {
          const passwordField = document.getElementById('password') as HTMLInputElement;
          if (passwordField) {
            passwordField.focus();
          }
        }, 100);
      }
    }
  }

  /**
   * Efface les informations mémorisées
   */
  clearRememberedData(): void {
    this.authService.clearRememberedCredentials();
    this.loginForm.patchValue({
      username: '',
      rememberMe: false
    });
    this.toastrNotification.showFormInfo('Informations mémorisées effacées', 'Données effacées');
  }

  /**
   * Vérifie si des données sont mémorisées
   */
  hasRememberedData(): boolean {
    return this.authService.isRememberMeEnabled() && !!this.authService.getRememberedUsername();
  }

  /**
   * Affiche une info-bulle expliquant pourquoi le mot de passe n'est pas mémorisé
   */
  showPasswordSecurityInfo(): void {
    this.toastrNotification.showFormInfo(
      'Pour votre sécurité, seul le nom d\'utilisateur est mémorisé. Le navigateur peut proposer de sauvegarder votre mot de passe de façon sécurisée.',
      'Sécurité des mots de passe'
    );
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.error = '';

      const formValue = this.loginForm.value;
      const credentials: LoginRequest = {
        username: formValue.username,
        password: formValue.password
      };
      const rememberMe = formValue.rememberMe;

      this.authService.login(credentials, rememberMe).subscribe({
        next: (response) => {
          this.loading = false;
          this.toastrNotification.showLoginSuccess(response.username);
          // Rediriger selon le rôle de l'utilisateur
          if (this.authService.isAdmin() || this.authService.isHR()) {
            this.router.navigate(['/admin/dashboard']);
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Nom d\'utilisateur ou mot de passe incorrect';
          this.toastrNotification.showLoginError();
          console.error('Erreur de connexion:', error);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        return 'Ce champ est requis';
      }
      if (field.errors['minlength']) {
        return 'Le mot de passe doit contenir au moins 6 caractères';
      }
    }
    return '';
  }
}

