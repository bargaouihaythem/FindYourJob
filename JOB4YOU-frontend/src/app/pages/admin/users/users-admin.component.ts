import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { DepartmentService } from '../../../services/department.service';
import { User, Department } from '../../../models/interfaces';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-admin.component.html',
  styleUrl: './users-admin.component.scss'
})
export class UsersAdminComponent implements OnInit {
  users: User[] = [];
  departments: Department[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private userService: UserService,
    private departmentService: DepartmentService,
    private toastrNotification: ToastrNotificationService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDepartments();
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.users = users;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        this.error = 'Erreur lors du chargement des utilisateurs';
        this.loading = false;
      }
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (departments: Department[]) => this.departments = departments,
      error: (error: any) => console.error('Erreur lors du chargement des départements:', error)
    });
  }

  onDepartmentChange(user: User, event: Event): void {
    const departmentId = Number((event.target as HTMLSelectElement).value);
    if (!departmentId) return;

    this.userService.assignDepartment(user.id, departmentId).subscribe({
      next: (updated: User) => {
        user.departmentId = updated.departmentId;
        user.departmentName = updated.departmentName;
        this.toastrNotification.showSuccess(`Département assigné à ${user.username}`);
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'assignation du département:', error);
        this.toastrNotification.showError('Erreur lors de l\'assignation du département');
      }
    });
  }
}
