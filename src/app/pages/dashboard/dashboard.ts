import { Component } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {
  
  userRole: string | null = '';

  constructor(private router: Router, private auth: Auth) {
    this.userRole = this.auth.getRole();
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}

