import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Réservé aux visiteurs anonymes (pas de compte) et aux candidats (ROLE_USER) :
 * utilisé pour des pages comme "Trouvez votre job idéal" (matching CV → offres),
 * qui n'ont aucun sens pour le personnel interne (RH/Manager/Admin/équipe).
 * Contrairement à RoleGuard, ne redirige PAS vers /login si non authentifié.
 */
@Injectable({ providedIn: 'root' })
export class CandidateOrAnonymousGuard implements CanActivate {
  private static readonly STAFF_ROLES = [
    'ROLE_ADMIN', 'ROLE_HR', 'ROLE_MANAGER',
    'ROLE_TEAM_LEAD', 'ROLE_SENIOR_DEV', 'ROLE_TEAM'
  ];

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (!this.authService.isAuthenticated()) {
      return true;
    }

    const user = this.authService.getCurrentUser();
    const isStaff = !!user && user.roles.some(role => CandidateOrAnonymousGuard.STAFF_ROLES.includes(role));

    if (isStaff) {
      return this.router.parseUrl('/admin/dashboard');
    }

    return true;
  }
}
