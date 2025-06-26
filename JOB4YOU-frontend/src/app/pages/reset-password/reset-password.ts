import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  loading = false;
  email = '';
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastrNotification: ToastrNotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetPasswordForm = this.fb.group({
      resetCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Récupérer l'email depuis les paramètres de requête
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword?.errors?.['passwordMismatch']) {
      delete confirmPassword.errors['passwordMismatch'];
      if (Object.keys(confirmPassword.errors).length === 0) {
        confirmPassword.setErrors(null);
      }
    }
    return null;
  }

  onSubmit(): void {
    if (this.resetPasswordForm.valid && !this.loading) {
      this.loading = true;
      const { resetCode, newPassword } = this.resetPasswordForm.value;

      this.authService.resetPassword(resetCode, newPassword).subscribe({
        next: (response) => {
          this.loading = false;
          this.toastrNotification.showPasswordResetSuccess();
          // Rediriger vers la page de connexion
          this.router.navigate(['/login']);
        },
        error: (error) => {
          this.loading = false;
          const errorMessage = error.error?.message || 'Code invalide ou expiré';
          this.toastrNotification.showPasswordResetError(errorMessage);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  resendCode(): void {
    if (this.email) {
      this.authService.requestPasswordReset(this.email).subscribe({
        next: (response) => {
          this.toastrNotification.showPasswordResetCodeSent();
        },
        error: (error) => {
          this.toastrNotification.showPasswordResetError('Erreur lors du renvoi du code');
        }
      });
    } else {
      this.router.navigate(['/forgot-password']);
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.resetPasswordForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        return 'Ce champ est requis';
      }
      if (field.errors['minlength']) {
        const requiredLength = field.errors['minlength'].requiredLength;
        return `Ce champ doit contenir au moins ${requiredLength} caractères`;
      }
      if (field.errors['pattern']) {
        return 'Le code doit contenir exactement 6 chiffres';
      }
      if (field.errors['passwordMismatch']) {
        return 'Les mots de passe ne correspondent pas';
      }
    }
    return '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.resetPasswordForm.controls).forEach(key => {
      const control = this.resetPasswordForm.get(key);
      control?.markAsTouched();
    });
  }
}
