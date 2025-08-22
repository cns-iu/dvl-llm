import { Component, OnInit } from '@angular/core';
import {
  Router,
  NavigationEnd,
  ActivatedRoute,
  RouterModule,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { AppService, UserStory } from '../app.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
})
export class BreadcrumbComponent implements OnInit {
  /** The three fixed steps */
  private defaultSteps: { label: string }[] = [
    { label: 'Select dataset' },
    { label: 'Select visualization' },
    { label: 'Optimize with AI' },
  ];
  rawSvgs = [
    `<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect y="0.5" width="24" height="24" rx="12" fill="#4B4B5E"/>
<path d="M11.764 17.5V8.428L9.86 9.644L9.172 8.476L12.084 6.508H13.38V17.5H11.764Z" fill="white"/>
</svg>
`,
    `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="0.5" y="0.5" width="24" height="24" rx="12" fill="#4B4B5E"/>
<path d="M8.3 17.5V16.172L12.332 12.844C13.804 11.612 14.364 10.668 14.364 9.676C14.364 8.476 13.372 7.772 12.284 7.772C11.084 7.772 10.204 8.412 9.436 9.404L8.348 8.444C9.308 7.116 10.604 6.316 12.348 6.316C14.396 6.316 16.028 7.644 16.028 9.644C16.028 11.116 15.324 12.284 13.436 13.82L10.86 15.996H16.124V17.5H8.3Z" fill="white"/>
</svg>
`,
    `<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect y="0.5" width="24" height="24" rx="12" fill="#4B4B5E"/>
<path d="M11.832 17.692C9.96 17.692 8.536 16.876 7.688 15.82L8.728 14.748C9.464 15.644 10.536 16.236 11.8 16.236C13.224 16.236 14.136 15.484 14.136 14.38C14.136 13.244 13.176 12.652 11.544 12.668H10.344V11.228L11.544 11.244C12.936 11.244 13.912 10.636 13.912 9.532C13.912 8.508 12.952 7.772 11.672 7.772C10.52 7.772 9.672 8.348 8.904 9.244L7.896 8.252C8.744 7.148 9.992 6.316 11.784 6.316C14.008 6.316 15.544 7.548 15.544 9.308C15.544 10.668 14.6 11.516 13.448 11.868C14.584 12.124 15.784 12.956 15.784 14.492C15.784 16.348 14.216 17.692 11.832 17.692Z" fill="white"/>
</svg>
`,
  ];

  icons: SafeHtml[];

  steps: (MenuItem & { label: string })[] = [];

  currentStep = -1;

  /** supporting text under each step, if any */
  stepDescriptions: (string | undefined)[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private appService: AppService,
    private sanitizer: DomSanitizer
  ) {
    this.icons = this.rawSvgs.map((svg) =>
      this.sanitizer.bypassSecurityTrustHtml(svg)
    );
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        // 1) Rebuild only the links & labels for steps we've visited
        const crumbs = this.buildBreadcrumbs(this.route.root);

        // 2) Always show 3 steps; for each index:
        //    - If crumbs[i] exists, use its routerLink
        this.steps = this.defaultSteps.map((def, i) => ({
          label: def.label,
          routerLink: crumbs[i]?.routerLink || ['/gather'],
          routerLinkActiveOptions: { exact: true },
        }));

        // 3) Update currentStep as the last crumb index
        this.currentStep = Math.min(crumbs.length - 1, 2);

        // 4) Clear previous descriptions
        this.stepDescriptions = [];

        // 5) If step1 visited, fetch and set its description
        if (this.currentStep >= 1) {
          const parts = this.router.url.split('/').filter(Boolean);
          const storyId = Number(parts[2]);
          if (!isNaN(storyId)) {
            this.appService
              .getUserStoryById(storyId)
              .subscribe((s: UserStory) => {
                this.stepDescriptions[0] = s.userstory;
              });
          }
        }

        // 6) If step2 visited, pull viz params from history.state
        if (this.currentStep >= 2) {
          const st = window.history.state;
          this.stepDescriptions[1] =
            st.model && st.language && st.library
              ? `${st.model}, ${st.language}, ${st.library}`
              : undefined;
        }
      });
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url: string = '',
    breadcrumbs: MenuItem[] = []
  ): MenuItem[] {
    const children = route.children;
    if (!children.length) return breadcrumbs;
    for (const child of children) {
      const path = child.snapshot.url.map((s) => s.path).join('/');
      if (path) {
        url += `/${path}`;
        let label = '';
        if (path === 'gather') label = 'Select dataset';
        else if (path.includes('analyze')) label = 'Select visualization';
        else if (path.includes('deploy')) label = 'Optimize with AI';
        if (label) {
          const segs = url.split('/').filter(Boolean);
          breadcrumbs.push({
            label,
            routerLink: ['/', ...segs],
            routerLinkActiveOptions: { exact: true },
          });
        }
      }
      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }
    return breadcrumbs;
  }
}
