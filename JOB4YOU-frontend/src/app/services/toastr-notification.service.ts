import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class ToastrNotificationService {

  constructor(private toastr: ToastrService) { }

  /**
   * Affiche un message de succès
   */
  showSuccess(message: string, title: string = 'Succès', position: string = 'toast-top-center'): void {
    this.toastr.success(message, title, {
      timeOut: 4000,
      closeButton: true,
      progressBar: true,
      positionClass: position
    });
  }

  /**
   * Affiche un message d'erreur
   */
  showError(message: string, title: string = 'Erreur', position: string = 'toast-top-center'): void {
    this.toastr.error(message, title, {
      timeOut: 6000,
      closeButton: true,
      progressBar: true,
      positionClass: position
    });
  }

  /**
   * Affiche un message d'avertissement
   */
  showWarning(message: string, title: string = 'Attention', position: string = 'toast-top-center'): void {
    this.toastr.warning(message, title, {
      timeOut: 5000,
      closeButton: true,
      progressBar: true,
      positionClass: position
    });
  }

  /**
   * Affiche un message d'information
   */
  showInfo(message: string, title: string = 'Information', position: string = 'toast-top-center'): void {
    this.toastr.info(message, title, {
      timeOut: 4000,
      closeButton: true,
      progressBar: true,
      positionClass: position
    });
  }

  // Méthodes spécifiques pour les formulaires (position en haut)
  showFormSuccess(message: string, title: string = 'Succès'): void {
    this.showSuccess(message, title, 'toast-top-center');
  }

  showFormError(message: string, title: string = 'Erreur'): void {
    this.showError(message, title, 'toast-top-center');
  }

  showFormWarning(message: string, title: string = 'Attention'): void {
    this.showWarning(message, title, 'toast-top-center');
  }

  showFormInfo(message: string, title: string = 'Information'): void {
    this.showInfo(message, title, 'toast-top-center');
  }

  /**
   * Méthodes spécifiques pour les actions de l'application
   */
  
  // Authentification - utilisent les toasts en haut pour les formulaires
  showLoginSuccess(username: string): void {
    this.showFormSuccess(`Bienvenue ${username} !`, 'Connexion réussie');
  }

  showLoginError(): void {
    this.showFormError('Nom d\'utilisateur ou mot de passe incorrect', 'Échec de connexion');
  }

  showLogoutSuccess(): void {
    this.showInfo('Vous avez été déconnecté avec succès', 'Déconnexion');
  }

  // Inscription - utilisent les toasts en haut pour les formulaires
  showRegisterSuccess(): void {
    this.showFormSuccess('Votre compte a été créé avec succès !', 'Inscription réussie');
  }

  showRegisterError(message: string = 'Erreur lors de la création du compte'): void {
    this.showFormError(message, 'Échec de l\'inscription');
  }

  // Mot de passe oublié - utilisent les toasts en haut pour les formulaires
  showPasswordResetCodeSent(): void {
    this.showFormSuccess('Un code de réinitialisation a été envoyé à votre adresse email', 'Code envoyé');
  }

  showPasswordResetSuccess(): void {
    this.showFormSuccess('Votre mot de passe a été réinitialisé avec succès', 'Mot de passe modifié');
  }

  showPasswordResetError(message: string = 'Erreur lors de la réinitialisation'): void {
    this.showFormError(message, 'Échec de réinitialisation');
  }

  // Candidatures
  showApplicationSuccess(): void {
    this.showSuccess('Votre candidature a été envoyée avec succès !', 'Candidature envoyée');
  }

  showApplicationError(): void {
    this.showError('Erreur lors de l\'envoi de votre candidature', 'Échec d\'envoi');
  }

  // CV
  showCvUploadSuccess(): void {
    this.showSuccess('Votre CV a été téléchargé avec succès', 'CV mis à jour');
  }

  showCvUploadError(): void {
    this.showError('Erreur lors du téléchargement du CV', 'Échec du téléchargement');
  }

  // Profil
  showProfileUpdateSuccess(): void {
    this.showSuccess('Votre profil a été mis à jour avec succès', 'Profil mis à jour');
  }

  showProfileUpdateError(): void {
    this.showError('Erreur lors de la mise à jour du profil', 'Échec de mise à jour');
  }

  // Emails
  showEmailSentSuccess(): void {
    this.showSuccess('Email envoyé avec succès', 'Email envoyé');
  }

  showEmailSentError(): void {
    this.showError('Erreur lors de l\'envoi de l\'email', 'Échec d\'envoi');
  }

  // Feedbacks
  showFeedbackSentSuccess(): void {
    this.showSuccess('Feedback envoyé avec succès', 'Feedback envoyé');
  }

  showFeedbackError(): void {
    this.showError('Erreur lors de l\'envoi du feedback', 'Échec d\'envoi');
  }

  // Erreurs génériques
  showNetworkError(): void {
    this.showError('Erreur de connexion. Veuillez réessayer.', 'Erreur réseau');
  }

  showServerError(): void {
    this.showError('Erreur serveur. Veuillez réessayer plus tard.', 'Erreur serveur');
  }

  showUnauthorizedError(): void {
    this.showError('Vous n\'êtes pas autorisé à effectuer cette action', 'Accès refusé');
  }

  showValidationError(message: string): void {
    this.showWarning(message, 'Données invalides');
  }

  // Erreurs de validation spécifiques aux formulaires (en haut)
  showFormValidationError(message: string): void {
    this.showFormWarning(message, 'Données invalides');
  }

  // Job Offers - méthodes spécifiques
  showJobOfferCreatedSuccess(): void {
    this.showSuccess('Offre d\'emploi créée avec succès !', 'Offre créée');
  }

  showJobOfferUpdatedSuccess(): void {
    this.showSuccess('Offre d\'emploi mise à jour avec succès !', 'Offre mise à jour');
  }

  showJobOfferDeletedSuccess(): void {
    this.showSuccess('Offre d\'emploi supprimée avec succès !', 'Offre supprimée');
  }

  showJobOfferStatusUpdatedSuccess(status: string): void {
    this.showSuccess(`Statut de l'offre mis à jour : ${status}`, 'Statut modifié');
  }

  showJobOfferError(message: string = 'Erreur lors de l\'opération sur l\'offre'): void {
    this.showError(message, 'Erreur offre');
  }

  showJobOfferAlreadyInStatus(status: string): void {
    this.showInfo(`L'offre est déjà ${status}`, 'Information');
  }

  // Candidates - méthodes spécifiques
  showCandidateCreatedSuccess(): void {
    this.showSuccess('Candidat créé avec succès !', 'Candidat créé');
  }

  showCandidateUpdatedSuccess(): void {
    this.showSuccess('Candidat mis à jour avec succès !', 'Candidat mis à jour');
  }

  showCandidateDeletedSuccess(): void {
    this.showSuccess('Candidat supprimé avec succès !', 'Candidat supprimé');
  }

  showCandidateError(message: string = 'Erreur lors de l\'opération sur le candidat'): void {
    this.showError(message, 'Erreur candidat');
  }

  // Notifications - méthodes spécifiques
  showNotificationSentSuccess(): void {
    this.showSuccess('Notification envoyée avec succès !', 'Notification envoyée');
  }

  showNotificationDeletedSuccess(): void {
    this.showSuccess('Notification supprimée avec succès !', 'Notification supprimée');
  }

  showNotificationError(message: string = 'Erreur lors de l\'opération sur la notification'): void {
    this.showError(message, 'Erreur notification');
  }

  // Interviews - méthodes spécifiques
  showInterviewCreatedSuccess(): void {
    this.showSuccess('Entretien créé avec succès !', 'Entretien créé');
  }

  showInterviewUpdatedSuccess(): void {
    this.showSuccess('Entretien mis à jour avec succès !', 'Entretien mis à jour');
  }

  showInterviewDeletedSuccess(): void {
    this.showSuccess('Entretien supprimé avec succès !', 'Entretien supprimé');
  }

  showInterviewStatusUpdatedSuccess(): void {
    this.showSuccess('Statut de l\'entretien mis à jour avec succès !', 'Statut modifié');
  }

  showInterviewScheduledSuccess(): void {
    this.showSuccess('Entretien planifié avec succès', 'Entretien planifié');
  }

  showInterviewError(message: string = 'Erreur lors de l\'opération sur l\'entretien'): void {
    this.showError(message, 'Erreur entretien');
  }

  showBulkOperationSuccess(operation: string): void {
    this.showSuccess(`${operation} en lot effectuée !`, 'Opération réussie');
  }

  showExportSuccess(format: string): void {
    this.showSuccess(`Export ${format.toUpperCase()} terminé !`, 'Export réussi');
  }

  showNoSelectionWarning(): void {
    this.showWarning('Aucun élément sélectionné', 'Sélection vide');
  }

  // Méthodes utilitaires pour différents contextes
  
  /**
   * Pour les actions CRUD (create, update, delete) - position bottom-right
   */
  showCrudSuccess(action: string, entity: string): void {
    this.showSuccess(`${entity} ${action} avec succès !`, 'Opération réussie');
  }

  showCrudError(action: string, entity: string): void {
    this.showError(`Erreur lors de ${action} de ${entity}`, 'Opération échouée');
  }

  /**
   * Pour les formulaires - position top-center
   */
  showFormSubmitSuccess(message: string = 'Formulaire envoyé avec succès'): void {
    this.showFormSuccess(message, 'Envoi réussi');
  }

  showFormSubmitError(message: string = 'Erreur lors de l\'envoi du formulaire'): void {
    this.showFormError(message, 'Envoi échoué');
  }

  /**
   * Pour les validations de champs - position top-center
   */
  showFieldValidationError(fieldName: string, requirement: string): void {
    this.showFormWarning(`${fieldName} : ${requirement}`, 'Champ invalide');
  }

  /**
   * Pour les confirmations d'actions - position top-center
   */
  showActionConfirmation(message: string): void {
    this.showFormInfo(message, 'Confirmation');
  }

  /**
   * Efface toutes les notifications actives
   */
  clearAll(): void {
    this.toastr.clear();
  }
}
