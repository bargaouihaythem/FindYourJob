import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-toastr-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-4">
      <div class="row">
        <div class="col-12">
          <h2>🧪 Test des Notifications Toastr</h2>
          <p class="text-muted">Testez toutes les positions et types de notifications</p>
          
          <div class="row">
            <!-- Tests des positions -->
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  <h5>📍 Test des Positions</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-success" (click)="testTopCenter()">
                      📋 Top Center (Formulaires)
                    </button>
                    <button class="btn btn-info" (click)="testBottomRight()">
                      📌 Bottom Right (Actions)
                    </button>
                    <button class="btn btn-warning" (click)="testTopRight()">
                      🔔 Top Right
                    </button>
                    <button class="btn btn-secondary" (click)="testBottomLeft()">
                      📍 Bottom Left
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tests des contextes -->
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  <h5>🎯 Test des Contextes</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-primary" (click)="testFormSuccess()">
                      ✅ Succès Formulaire
                    </button>
                    <button class="btn btn-danger" (click)="testFormError()">
                      ❌ Erreur Formulaire
                    </button>
                    <button class="btn btn-warning" (click)="testFormValidation()">
                      ⚠️ Validation Formulaire
                    </button>
                    <button class="btn btn-info" (click)="testCrudOperations()">
                      🔄 Opérations CRUD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tests d'authentification -->
          <div class="row mt-4">
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  <h5>🔐 Test Authentification</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-success" (click)="testLoginSuccess()">
                      🚀 Connexion Réussie
                    </button>
                    <button class="btn btn-danger" (click)="testLoginError()">
                      🚫 Erreur Connexion
                    </button>
                    <button class="btn btn-primary" (click)="testRegisterSuccess()">
                      📝 Inscription Réussie
                    </button>
                    <button class="btn btn-warning" (click)="testPasswordReset()">
                      🔑 Réinitialisation MDP
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tests avancés -->
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  <h5>⚡ Tests Avancés</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-info" (click)="testSequence()">
                      🎬 Séquence de Tests
                    </button>
                    <button class="btn btn-secondary" (click)="testAllTypes()">
                      🌈 Tous les Types
                    </button>
                    <button class="btn btn-warning" (click)="testOverlap()">
                      📚 Test Superposition
                    </button>
                    <button class="btn btn-dark" (click)="clearAll()">
                      🗑️ Effacer Tout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Simulateur de formulaire -->
          <div class="row mt-4">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h5>📋 Simulateur de Formulaire</h5>
                </div>
                <div class="card-body">
                  <form class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label">Email</label>
                      <input type="email" class="form-control" placeholder="test@example.com">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Mot de passe</label>
                      <input type="password" class="form-control" placeholder="********">
                    </div>
                    <div class="col-12">
                      <button type="button" class="btn btn-success me-2" (click)="testFormSubmitSuccess()">
                        ✅ Soumission Réussie
                      </button>
                      <button type="button" class="btn btn-danger me-2" (click)="testFormSubmitError()">
                        ❌ Erreur Soumission
                      </button>
                      <button type="button" class="btn btn-warning" (click)="testFieldValidation()">
                        ⚠️ Erreur Champ
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border: none;
      margin-bottom: 20px;
    }
    
    .card-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-bottom: none;
    }
    
    .btn {
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    
    h2 {
      color: #333;
      margin-bottom: 20px;
    }
    
    .container {
      max-width: 1200px;
    }
  `]
})
export class ToastrTestComponent {

  constructor(private toastrNotification: ToastrNotificationService) {}

  // Tests des positions
  testTopCenter() {
    this.toastrNotification.showSuccess('Message en haut au centre', 'Position Top-Center', 'toast-top-center');
  }

  testBottomRight() {
    this.toastrNotification.showInfo('Message en bas à droite', 'Position Bottom-Right', 'toast-bottom-right');
  }

  testTopRight() {
    this.toastrNotification.showWarning('Message en haut à droite', 'Position Top-Right', 'toast-top-right');
  }

  testBottomLeft() {
    this.toastrNotification.showError('Message en bas à gauche', 'Position Bottom-Left', 'toast-bottom-left');
  }

  // Tests des contextes formulaires
  testFormSuccess() {
    this.toastrNotification.showFormSuccess('Formulaire soumis avec succès !');
  }

  testFormError() {
    this.toastrNotification.showFormError('Erreur lors de la soumission du formulaire');
  }

  testFormValidation() {
    this.toastrNotification.showFormValidationError('Veuillez remplir tous les champs obligatoires');
  }

  testCrudOperations() {
    this.toastrNotification.showCrudSuccess('créé', 'L\'élément');
    setTimeout(() => {
      this.toastrNotification.showCrudSuccess('mis à jour', 'Le profil');
    }, 1000);
    setTimeout(() => {
      this.toastrNotification.showCrudSuccess('supprimé', 'La donnée');
    }, 2000);
  }

  // Tests d'authentification
  testLoginSuccess() {
    this.toastrNotification.showLoginSuccess('Jean Dupont');
  }

  testLoginError() {
    this.toastrNotification.showLoginError();
  }

  testRegisterSuccess() {
    this.toastrNotification.showRegisterSuccess();
  }

  testPasswordReset() {
    this.toastrNotification.showPasswordResetSuccess();
  }

  // Tests du simulateur de formulaire
  testFormSubmitSuccess() {
    this.toastrNotification.showFormSubmitSuccess();
  }

  testFormSubmitError() {
    this.toastrNotification.showFormSubmitError();
  }

  testFieldValidation() {
    this.toastrNotification.showFieldValidationError('Email', 'doit être une adresse email valide');
  }

  // Tests avancés
  testSequence() {
    const messages = [
      { method: 'showFormInfo', args: ['Début de la séquence...'] },
      { method: 'showFormSuccess', args: ['Étape 1 terminée'] },
      { method: 'showInfo', args: ['Étape 2 en cours...', 'Progression'] },
      { method: 'showSuccess', args: ['Séquence terminée !', 'Succès'] }
    ];

    messages.forEach((msg, index) => {
      setTimeout(() => {
        (this.toastrNotification as any)[msg.method](...msg.args);
      }, index * 1500);
    });
  }

  testAllTypes() {
    this.toastrNotification.showSuccess('Message de succès', 'Succès');
    setTimeout(() => this.toastrNotification.showError('Message d\'erreur', 'Erreur'), 500);
    setTimeout(() => this.toastrNotification.showWarning('Message d\'avertissement', 'Attention'), 1000);
    setTimeout(() => this.toastrNotification.showInfo('Message d\'information', 'Info'), 1500);
  }

  testOverlap() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.toastrNotification.showInfo(`Notification ${i + 1}`, 'Test Superposition');
      }, i * 200);
    }
  }

  clearAll() {
    this.toastrNotification.clearAll();
  }
}
