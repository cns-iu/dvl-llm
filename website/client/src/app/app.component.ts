import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
import { FooterComponent } from './footer/footer.component';
// import { HomeComponent } from './home/home.component';
import { StatusIndicatorComponent } from './status-indicator/status-indicator.component';

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
    BreadcrumbComponent,
    FooterComponent,
    // HomeComponent,
    StatusIndicatorComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'dvl-llm';

  tabRoutes = ['gather', 'analyze', 'deploy'];

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
