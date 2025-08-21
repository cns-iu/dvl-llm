import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss'],
})
export class ErrorComponent {
  message = 'This page isn’t available';

  constructor(private router: Router) {
    // Read message passed via router state (fallback to default)
    const st = this.router.getCurrentNavigation()?.extras?.state as
      | { message?: string }
      | undefined;
    if (st?.message) this.message = st.message;
  }

  goHome() {
    this.router.navigateByUrl('/');
  }
}
