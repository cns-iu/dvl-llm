import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from '../app.service';
import { switchMap, tap } from 'rxjs';

interface VisualizationItem {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  category: 'python' | 'javascript' | 'r' | 'other';
  library: string;
}

@Component({
  selector: 'app-analyze-data',
  standalone: true,
  imports: [MatIconModule, CommonModule, RouterModule],
  templateUrl: './analyze-data.component.html',
  styleUrls: ['./analyze-data.component.scss'],
})
export class AnalyzeDataComponent implements OnInit {
  visualizations: VisualizationItem[] = [];
  pythonVisualizations: VisualizationItem[] = [];
  javascriptVisualizations: VisualizationItem[] = [];
  rVisualizations: VisualizationItem[] = [];
  otherVisualizations: VisualizationItem[] = [];
  storyId = 0;
  currentSection: '' | 'python' | 'javascript' | 'r' | 'other' = '';
  destroyRef = inject(DestroyRef);

  constructor(
    private activatedRoute: ActivatedRoute,
    private appService: AppService,
    private router: Router
  ) {}

  get isChildRoute() {
    return this.router.url.includes('/deploy');
  }

  ngOnInit() {
    window.scrollTo({ top: 0 });
    this.currentSection = '';
    this.activatedRoute.params
      .pipe(
        tap((p) => (this.storyId = +p['id'])),
        switchMap((p) =>
          this.appService.getVisualizationsForUserStory(+p['id'])
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.visualizations = data.map((item, i) => ({
          id: `${this.storyId}-${i}`,
          title: item.llm,
          description: item.code,
          imagePath: item.image_url,
          category: this.getCategoryFromLanguage(item.language),
          library: item.library,
        }));

        // Filter visualizations by category
        this.pythonVisualizations = this.visualizations.filter(
          (v) => v.category === 'python'
        );
        this.javascriptVisualizations = this.visualizations.filter(
          (v) => v.category === 'javascript'
        );
        this.rVisualizations = this.visualizations.filter(
          (v) => v.category === 'r'
        );
        this.otherVisualizations = this.visualizations.filter(
          (v) => v.category === 'other'
        );
      });
  }

  private getCategoryFromLanguage(
    language: string
  ): 'python' | 'javascript' | 'r' | 'other' {
    switch (language.toLowerCase()) {
      case 'python':
        return 'python';
      case 'javascript':
        return 'javascript';
      case 'r':
        return 'r';
      default:
        return 'other';
    }
  }

  scrollTo(section: 'python' | 'javascript' | 'r' | 'other') {
    // Set the current section immediately for UI feedback
    this.currentSection = section;

    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Small delay to ensure the scroll has started, then update the section
      setTimeout(() => {
        this.currentSection = section;
      }, 100);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const sections = ['python', 'javascript', 'r', 'other'];
    let activeSection = '';

    for (const sec of sections) {
      const element = document.getElementById(sec);
      if (element) {
        const rect = element.getBoundingClientRect();
        // Check if the section is currently visible in the viewport
        if (rect.top <= 150 && rect.bottom > 150) {
          activeSection = sec;
          break;
        }
      }
    }

    // If we found an active section and it's different from current, update it
    if (activeSection && activeSection !== this.currentSection) {
      this.currentSection = activeSection as any;
    }
  }

  onExplore(viz: VisualizationItem) {
    this.router.navigate([`/gather/analyze/${this.storyId}/deploy/${viz.id}`], {
      state: {
        id: this.storyId,
        model: viz.title,
        language: viz.category,
        library: viz.library,
        isDVL: true,
      },
    });
  }
}
