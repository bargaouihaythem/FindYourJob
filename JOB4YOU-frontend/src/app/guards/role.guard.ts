import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: any): boolean | UrlTree {
    const expectedRoles: string[] = route.data['roles'] || [];
    if (!this.authService.isAuthenticated()) {
      return this.router.parseUrl('/login');
    }
    if (expectedRoles.length === 0) return true;
    for (const role of expectedRoles) {
      if (this.authService.hasRole(role)) return true;
    }
    // Redirige si le rôle n'est pas autorisé
    return this.router.parseUrl('/');
  }
}
