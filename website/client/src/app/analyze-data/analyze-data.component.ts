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
  category: 'python' | 'javascript' | 'r';
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
  storyId = 0;
  currentSection: '' | 'python' | 'javascript' | 'r' = '';
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
          category:
            item.language === 'python'
              ? 'python'
              : item.language === 'javascript'
              ? 'javascript'
              : 'r',
          library: item.library,
        }));
        this.pythonVisualizations = this.visualizations.filter(
          (v) => v.category === 'python'
        );
        this.javascriptVisualizations = this.visualizations.filter(
          (v) => v.category === 'javascript'
        );
        this.rVisualizations = this.visualizations.filter(
          (v) => v.category === 'r'
        );
      });
  }

  scrollTo(section: 'python' | 'javascript' | 'r') {
    this.currentSection = section;
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    for (const sec of ['python', 'javascript', 'r']) {
      const top = document.getElementById(sec)!.getBoundingClientRect().top;
      if (top <= 100) {
        this.currentSection = sec as any;
        break;
      }
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

// import { Component, DestroyRef, inject } from '@angular/core';
// import { MatIconModule } from '@angular/material/icon';
// import { CommonModule } from '@angular/common';
// import { ActivatedRoute, Router, RouterModule } from '@angular/router';
// import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// import { AppService } from '../app.service';
// import { switchMap, tap } from 'rxjs';

// interface VisualizationItem {
//   id: string;
//   title: string;
//   description: string;
//   imagePath: string;
//   category: 'python' | 'javascript' | 'r';
//   library: string;
// }

// @Component({
//   selector: 'app-analyze-data',
//   standalone: true,
//   imports: [MatIconModule, CommonModule, RouterModule],
//   templateUrl: './analyze-data.component.html',
//   styleUrl: './analyze-data.component.scss',
// })
// export class AnalyzeDataComponent {
//   visualizations: VisualizationItem[] = [];
//   destroyRef = inject(DestroyRef);

//   pythonVisualizations: VisualizationItem[] = [];
//   javascriptVisualizations: VisualizationItem[] = [];
//   rVisualizations: VisualizationItem[] = [];
//   storyId: number = 0;

//   constructor(
//     private activatedRoute: ActivatedRoute,
//     private appService: AppService,
//     private router: Router
//   ) {}

//   get isChildRoute(): boolean {
//     return this.router.url.includes('/deploy');
//   }

//   ngOnInit() {
//     this.activatedRoute.params
//       .pipe(
//         tap((params) => {
//           this.storyId = +params['id'];
//         }),
//         switchMap((params) =>
//           this.appService.getVisualizationsForUserStory(+params['id'])
//         ),
//         takeUntilDestroyed(this.destroyRef)
//       )
//       .subscribe((data) => {
//         this.visualizations = data.map((item, index) => ({
//           id: `${this.storyId}-${index}`,
//           title: `${item.llm}`,
//           description: item.code,
//           imagePath: item.image_url,
//           category:
//             item.language === 'python'
//               ? 'python'
//               : item.language === 'javascript'
//               ? 'javascript'
//               : 'r',
//           library: item.library,
//         }));

//         this.pythonVisualizations = this.visualizations.filter(
//           (v) => v.category === 'python'
//         );
//         this.javascriptVisualizations = this.visualizations.filter(
//           (v) => v.category === 'javascript'
//         );
//         this.rVisualizations = this.visualizations.filter(
//           (v) => v.category === 'r'
//         );
//       });
//   }
//   onExplore(visualization: VisualizationItem) {
//     console.log('Exploring visualization:', visualization.title);
//     this.router.navigate(
//       [`/gather/analyze/${this.storyId}/deploy/${visualization.id}`],
//       {
//         state: {
//           id: this.storyId,
//           model: visualization.title,
//           language: visualization.category,
//           library: visualization.library,
//           isDVL: true,
//         },
//       }
//     );
//   }
//   // logic to scroll
//   currentSection = 'python';

//   scrollTo(sectionId: string) {
//     const el = document.getElementById(sectionId);
//     if (!el) return;
//     el.scrollIntoView({ behavior: 'smooth', block: 'start' });
//     this.currentSection = sectionId;
//   }
//   //
// }
