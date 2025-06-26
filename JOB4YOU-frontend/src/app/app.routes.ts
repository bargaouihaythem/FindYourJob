import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { JobOffersComponent } from './pages/job-offers/job-offers';
import { JobDetailComponent } from './pages/job-detail/job-detail';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/reset-password/reset-password';
import { RoleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'job-offers', component: JobOffersComponent },
  { path: 'job-offers/:id', component: JobDetailComponent },
  
  // Candidate routes
  { path: 'candidate/my-applications', loadComponent: () => import('./pages/candidate/my-applications/my-applications.component').then(m => m.MyApplicationsComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_USER'] } },
  { path: 'candidate/my-interviews', loadComponent: () => import('./pages/candidate/my-interviews/my-interviews.component').then(m => m.MyInterviewsComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_USER'] } },
  
  // Admin routes
  { path: 'admin/dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR'] } },
  { path: 'admin/candidates', loadComponent: () => import('./pages/admin/candidates/candidates.component').then(m => m.CandidatesComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR'] } },
  { path: 'admin/job-offers', loadComponent: () => import('./pages/admin/job-offers/job-offers-admin.component').then(m => m.JobOffersAdminComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR'] } },
  { path: 'admin/interviews', loadComponent: () => import('./pages/admin/interviews/interviews.component').then(m => m.InterviewsComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR', 'ROLE_MANAGER'] } },
  { path: 'admin/feedbacks', loadComponent: () => import('./pages/admin/feedbacks/feedbacks-admin.component').then(m => m.FeedbacksAdminComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR', 'ROLE_MANAGER'] } },
  { path: 'admin/notifications', loadComponent: () => import('./pages/admin/notifications/notifications.component').then(m => m.NotificationsComponent), canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN', 'ROLE_HR'] } },
  
  // Test page for toasters
  { path: 'test-toasts', loadComponent: () => import('./pages/toastr-test/toastr-test.component').then(m => m.ToastrTestComponent) },
  
  { path: '**', redirectTo: '' }
];

