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
  showPassword = false; // Propriété pour afficher/cacher le mot de passe

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastrNotification: ToastrNotificationService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Bascule l'affichage du mot de passe
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
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

      this.authService.login(credentials).subscribe({
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

