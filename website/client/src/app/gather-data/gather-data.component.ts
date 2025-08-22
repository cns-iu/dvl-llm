import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppService, UserStory } from '../app.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gather-data',
  standalone: true,
  templateUrl: './gather-data.component.html',
  styleUrls: ['./gather-data.component.scss'],
  imports: [CommonModule, RouterModule],
})
export class GatherDataComponent {
  userStories: UserStory[] = [];
  sectionIds: string[] = []; //  holds unique categories
  currentSection = ''; // tracks which section is active
  destroyRef = inject(DestroyRef);

  constructor(private router: Router, private appService: AppService) {}

  get isChildRoute(): boolean {
    return this.router.url?.includes('/analyze');
  }

  ngOnInit() {
    window.scrollTo({ top: 0 });
    this.appService
      .getUserStories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((stories) => {
        this.userStories = stories;
        this.sectionIds = Array.from(new Set(stories.map((s) => s.category)));
      });
  }

  // helper to filter cards per category
  getStoriesByCategory(cat: string): UserStory[] {
    return this.userStories.filter((s) => s.category === cat);
  }

  // scroll and set active
  scrollTo(id: string) {
    this.currentSection = id;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // watch scrolling to update `currentSection`
  @HostListener('window:scroll', [])
  onWindowScroll() {
    for (const id of this.sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      // when section top is near viewport top
      if (top <= 100) {
        this.currentSection = id;
      }
    }
  }

  onExplore(storyId: number) {
    this.router.navigate(['/gather/analyze', storyId]);
  }
}
