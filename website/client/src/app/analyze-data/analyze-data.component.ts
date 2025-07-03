import { Component, DestroyRef, inject } from '@angular/core';
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
  category: 'python' | 'javascript';
  library: string;
}

@Component({
  selector: 'app-analyze-data',
  standalone: true,
  imports: [MatIconModule, CommonModule, RouterModule],
  templateUrl: './analyze-data.component.html',
  styleUrl: './analyze-data.component.scss',
})
export class AnalyzeDataComponent {
  visualizations: VisualizationItem[] = [];
  destroyRef = inject(DestroyRef);

  pythonVisualizations: VisualizationItem[] = [];
  javascriptVisualizations: VisualizationItem[] = [];
  storyId: number = 0;

  constructor(
    private activatedRoute: ActivatedRoute,
    private appService: AppService,
    private router: Router
  ) {}

  get isChildRoute(): boolean {
    return this.router.url.includes('/deploy');
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        tap((params) => {
          this.storyId = +params['id'];
        }),
        switchMap((params) =>
          this.appService.getVisualizationsForUserStory(+params['id'])
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.visualizations = data.map((item, index) => ({
          id: `${this.storyId}-${index}`,
          title: `${item.llm}`,
          description: item.code,
          imagePath: item.image_url,
          category: item.language === 'python' ? 'python' : 'javascript',
          library: item.library,
        }));

        this.pythonVisualizations = this.visualizations.filter(
          (v) => v.category === 'python'
        );
        this.javascriptVisualizations = this.visualizations.filter(
          (v) => v.category === 'javascript'
        );
      });
  }

  onExplore(visualization: VisualizationItem) {
    console.log('Exploring visualization:', visualization.title);
    this.router.navigate([
      `/gather/analyze/${this.storyId}/deploy/${visualization.id}`,
    ]);
  }
}
