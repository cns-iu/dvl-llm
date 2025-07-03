import { Component, DestroyRef, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppService, UserStory } from '../app.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-gather-data',
  standalone: true,
  templateUrl: './gather-data.component.html',
  styleUrls: ['./gather-data.component.scss'],
  imports: [RouterModule],
})
export class GatherDataComponent {
  title = 'Acquire Data App';
  userStories: UserStory[] = [];
  destroyRef = inject(DestroyRef);

  constructor(private router: Router, private appService: AppService) {}

  get isChildRoute(): boolean {
    return this.router.url?.includes('/analyze');
  }

  ngOnInit() {
    this.appService
      .getUserStories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((stories) => {
        this.userStories = stories;
      });
  }

  onExplore(storyId: number) {
    this.router.navigate(['/gather/analyze', storyId]);
  }
}
