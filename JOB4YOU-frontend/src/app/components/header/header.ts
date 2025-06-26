import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { User } from '../../models/interfaces';
import { ToastrNotificationService } from '../../services/toastr-notification.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastrNotification: ToastrNotificationService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isHR(): boolean {
    return this.authService.isHR();
  }

  isManager(): boolean {
    return this.authService.isManager();
  }

  isCandidate(): boolean {
    return this.isAuthenticated() && !this.isAdmin() && !this.isHR() && !this.isManager();
  }

  logout(): void {
    this.authService.logout();
    this.toastrNotification.showLogoutSuccess();
    this.router.navigate(['/']);
  }
}

