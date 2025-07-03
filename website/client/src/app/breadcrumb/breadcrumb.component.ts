import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Params,
  Router,
  RouterModule,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  standalone: true,
  imports: [BreadcrumbModule, RouterModule, CommonModule],
})
export class BreadcrumbComponent implements OnInit {
  items: MenuItem[] = [];
  destroyRef = inject(DestroyRef);

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.items = this.buildBreadcrumbs(this.route.root);
      });
  }

  buildBreadcrumbs(
    route: ActivatedRoute,
    url: string = '',
    breadcrumbs: MenuItem[] = []
  ): MenuItem[] {
    const children = route.children;
    if (children.length === 0) return breadcrumbs;

    for (const child of children) {
      const routeURL = child.snapshot.url
        .map((segment) => segment.path)
        .join('/');
      if (routeURL !== '') {
        let fullPath = `/${routeURL}`;
        const params = child.snapshot.params;
        // Replace route params like :id with actual values
        Object.entries(params).forEach(([key, value]) => {
          fullPath = fullPath.replace(`:${key}`, value);
        });

        url += fullPath;
        let label = '';

        if (routeURL === 'gather') {
          label = 'Acquire Data';
        } else if (routeURL.includes('analyze')) {
          label = 'Choose Visualization';
        } else if (routeURL.includes('deploy')) {
          label = 'Visualize and Iterate';
        }

        if (label) {
          const fullURL = url.split('/').filter(Boolean); // removes empty strings
          breadcrumbs.push({
            label,
            routerLink: ['/', ...fullURL],
            routerLinkActiveOptions: { exact: true },
          });
        }
      }

      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }
}
