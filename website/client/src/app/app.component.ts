import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    HttpClientModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'dvl-llm';

  tabRoutes = ['gather', 'analyze', 'dvl', 'visualize'];

  constructor(private router: Router) {}

  get selectedIndex(): number {
    const current = this.router.url.replace('/', '');
    return this.tabRoutes.indexOf(current);
  }

  onTabChange(index: number): void {
    const route = this.tabRoutes[index];
    this.router.navigateByUrl(`/${route}`);
  }
}
