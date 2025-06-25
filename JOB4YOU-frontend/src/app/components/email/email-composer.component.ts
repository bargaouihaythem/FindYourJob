import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService, CustomEmailRequest } from '../../services/notification.service';
import { Candidate } from '../../models/interfaces';

@Component({
  selector: 'app-email-composer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-composer.component.html',
  styleUrls: ['./email-composer.component.scss']
})
export class EmailComposerComponent {
  @Input() candidate?: Candidate;
  @Input() isVisible: boolean = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onEmailSent = new EventEmitter<void>();

  emailData: CustomEmailRequest = {
    to: '',
    subject: '',
    content: '',
    isHtml: false
  };

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  emailTemplates = [
    {
      name: 'Confirmation de candidature',
      subject: 'Confirmation de votre candidature',
      content: `Bonjour {{candidateName}},

Nous avons bien reçu votre candidature pour le poste de {{jobTitle}}.

Notre équipe RH va examiner votre dossier et vous tiendra informé(e) de la suite du processus de recrutement.

Cordialement,
L'équipe de recrutement`
    },
    {
      name: 'Invitation entretien',
      subject: 'Invitation à un entretien',
      content: `Bonjour {{candidateName}},

Nous avons le plaisir de vous inviter à un entretien pour le poste de {{jobTitle}}.

Détails de l'entretien :
- Date : {{interviewDate}}
- Heure : {{interviewTime}}
- Lieu : {{location}}

Merci de confirmer votre présence.

Cordialement,
L'équipe de recrutement`
    },
    {
      name: 'Feedback positif',
      subject: 'Suite de votre candidature',
      content: `Bonjour {{candidateName}},

Nous avons le plaisir de vous informer que votre candidature pour le poste de {{jobTitle}} a retenu notre attention.

Nous souhaitons poursuivre le processus de recrutement avec vous.

Cordialement,
L'équipe de recrutement`
    },
    {
      name: 'Feedback négatif',
      subject: 'Suite de votre candidature',
      content: `Bonjour {{candidateName}},

Nous vous remercions pour l'intérêt que vous avez porté au poste de {{jobTitle}}.

Après examen de votre candidature, nous regrettons de vous informer que nous ne pourrons pas donner suite à votre candidature pour ce poste.

Nous vous encourageons à consulter nos autres offres d'emploi.

Cordialement,
L'équipe de recrutement`
    }
  ];

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    if (this.candidate) {
      this.emailData.to = this.candidate.email;
    }
  }

  ngOnChanges() {
    if (this.candidate) {
      this.emailData.to = this.candidate.email;
    }
  }

  selectTemplate(template: any) {
    this.emailData.subject = template.subject;
    this.emailData.content = this.replacePlaceholders(template.content);
  }

  private replacePlaceholders(content: string): string {
    if (!this.candidate) return content;
    
    return content
      .replace(/{{candidateName}}/g, `${this.candidate.firstName} ${this.candidate.lastName}`)
      .replace(/{{jobTitle}}/g, this.candidate.jobOfferTitle || 'le poste')
      .replace(/{{interviewDate}}/g, new Date().toLocaleDateString('fr-FR'))
      .replace(/{{interviewTime}}/g, '14:00')
      .replace(/{{location}}/g, 'Nos bureaux');
  }

  sendEmail() {
    if (!this.emailData.to || !this.emailData.subject || !this.emailData.content) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.notificationService.sendCustomEmail(this.emailData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = response.message || 'Email envoyé avec succès !';
          this.isLoading = false;
          setTimeout(() => {
            this.onEmailSent.emit();
            this.close();
          }, 2000);
        } else {
          this.errorMessage = response.message || 'Erreur lors de l\'envoi de l\'email';
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = 'Erreur lors de l\'envoi de l\'email : ' + (error.error?.message || error.message);
        this.isLoading = false;
      }
    });
  }

  close() {
    this.isVisible = false;
    this.emailData = {
      to: this.candidate?.email || '',
      subject: '',
      content: '',
      isHtml: false
    };
    this.errorMessage = '';
    this.successMessage = '';
    this.onClose.emit();
  }
}

