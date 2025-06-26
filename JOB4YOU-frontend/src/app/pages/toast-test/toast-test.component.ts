import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-toast-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-4">
      <h2>Test des Notifications Toastr</h2>
      <div class="row">
        <div class="col-md-6">
          <h4>Tests de base</h4>
          <button class="btn btn-success me-2 mb-2" (click)="testSuccess()">Test Succès</button>
          <button class="btn btn-danger me-2 mb-2" (click)="testError()">Test Erreur</button>
          <button class="btn btn-warning me-2 mb-2" (click)="testWarning()">Test Avertissement</button>
          <button class="btn btn-info me-2 mb-2" (click)="testInfo()">Test Info</button>
        </div>
        <div class="col-md-6">
          <h4>Tests spécifiques</h4>
          <button class="btn btn-primary me-2 mb-2" (click)="testLogin()">Test Connexion</button>
          <button class="btn btn-secondary me-2 mb-2" (click)="testRegister()">Test Inscription</button>
          <button class="btn btn-dark me-2 mb-2" (click)="testLogout()">Test Déconnexion</button>
          <button class="btn btn-outline-success me-2 mb-2" (click)="testJobOffer()">Test Offre d'emploi</button>
          <button class="btn btn-outline-danger me-2 mb-2" (click)="testCandidate()">Test Candidat</button>
          <button class="btn btn-outline-warning me-2 mb-2" (click)="testFeedback()">Test Feedback</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
  `]
})
export class ToastTestComponent {
  
  constructor(private toastrNotification: ToastrNotificationService) {}

  testSuccess(): void {
    this.toastrNotification.showSuccess('Ceci est un message de succès !', 'Succès');
  }

  testError(): void {
    this.toastrNotification.showError('Ceci est un message d\'erreur !', 'Erreur');
  }

  testWarning(): void {
    this.toastrNotification.showWarning('Ceci est un message d\'avertissement !', 'Attention');
  }

  testInfo(): void {
    this.toastrNotification.showInfo('Ceci est un message d\'information !', 'Information');
  }

  testLogin(): void {
    this.toastrNotification.showLoginSuccess('admin');
  }

  testRegister(): void {
    this.toastrNotification.showRegisterSuccess();
  }

  testLogout(): void {
    this.toastrNotification.showLogoutSuccess();
  }

  testJobOffer(): void {
    this.toastrNotification.showJobOfferCreatedSuccess();
  }

  testCandidate(): void {
    this.toastrNotification.showCandidateUpdatedSuccess();
  }

  testFeedback(): void {
    this.toastrNotification.showFeedbackSentSuccess();
  }
}
