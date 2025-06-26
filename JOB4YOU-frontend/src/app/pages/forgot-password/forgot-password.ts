import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  loading = false;
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastrNotification: ToastrNotificationService,
    private router: Router
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.valid && !this.loading) {
      this.loading = true;
      const email = this.forgotPasswordForm.value.email;

      this.authService.requestPasswordReset(email).subscribe({
        next: (response) => {
          this.loading = false;
          this.toastrNotification.showPasswordResetCodeSent();
          // Rediriger vers la page de saisie du code avec l'email
          this.router.navigate(['/reset-password'], { queryParams: { email: email } });
        },
        error: (error) => {
          this.loading = false;
          const errorMessage = error.error?.message || 'Erreur lors de l\'envoi du code';
          this.toastrNotification.showPasswordResetError(errorMessage);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.forgotPasswordForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        return 'Ce champ est requis';
      }
      if (field.errors['email']) {
        return 'Veuillez entrer une adresse email valide';
      }
    }
    return '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.forgotPasswordForm.controls).forEach(key => {
      const control = this.forgotPasswordForm.get(key);
      control?.markAsTouched();
    });
  }
}
