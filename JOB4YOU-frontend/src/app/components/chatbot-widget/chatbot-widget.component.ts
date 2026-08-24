import { Component, ElementRef, OnDestroy, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ChatbotService } from '../../services/chatbot.service';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrls: ['./chatbot-widget.component.scss']
})
export class ChatbotWidgetComponent implements OnDestroy, AfterViewChecked {
  isOpen = false;
  isLoading = false;
  input = '';
  messages: ChatMessage[] = [];

  @ViewChild('panelBody') private panelBody?: ElementRef<HTMLDivElement>;
  private shouldScrollToBottom = false;
  private userSub: Subscription;

  constructor(
    private authService: AuthService,
    private chatbotService: ChatbotService,
    private sanitizer: DomSanitizer
  ) {
    // S'abonner pour réagir immédiatement à la connexion/déconnexion,
    // pas seulement au rechargement de page.
    this.userSub = this.authService.currentUser$.subscribe(() => {
      if (!this.isVisible()) {
        this.isOpen = false;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.panelBody) {
      this.panelBody.nativeElement.scrollTop = this.panelBody.nativeElement.scrollHeight;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.userSub.unsubscribe();
  }

  isVisible(): boolean {
    return this.authService.isAuthenticated() && this.authService.isCandidate();
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.loadGreeting();
    }
    if (this.isOpen) {
      this.shouldScrollToBottom = true;
    }
  }

  private loadGreeting(): void {
    this.isLoading = true;
    this.chatbotService.greeting()
      .pipe(
        catchError(() => of({
          greeting: "Bonjour ! Je suis l'assistant JOB4YOU. Posez-moi une question sur le suivi de vos candidatures."
        })),
        finalize(() => { this.isLoading = false; })
      )
      .subscribe(response => {
        this.messages.push({ role: 'bot', text: response.greeting });
        this.shouldScrollToBottom = true;
      });
  }

  close(): void {
    this.isOpen = false;
  }

  send(): void {
    const message = this.input.trim();
    if (!message || this.isLoading) {
      return;
    }

    this.messages.push({ role: 'user', text: message });
    this.input = '';
    this.isLoading = true;
    this.shouldScrollToBottom = true;

    this.chatbotService.ask(message)
      .pipe(
        catchError(() => of({ answer: "Désolé, une erreur de connexion est survenue. Merci de réessayer." })),
        finalize(() => { this.isLoading = false; })
      )
      .subscribe(response => {
        this.messages.push({ role: 'bot', text: response.answer });
        this.shouldScrollToBottom = true;
      });
  }

  /**
   * Rendu minimal : échappe le HTML puis n'autorise que **gras**, pour
   * éviter d'injecter du HTML arbitraire venant d'une réponse IA.
   */
  formatMessage(text: string): SafeHtml {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return this.sanitizer.bypassSecurityTrustHtml(withBold);
  }
}
