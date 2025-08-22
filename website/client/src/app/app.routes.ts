import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component'; // ← your new homepage
import { GatherDataComponent } from './gather-data/gather-data.component';
import { AnalyzeDataComponent } from './analyze-data/analyze-data.component';
import { ErrorComponent } from './error/error.component';

export const routes: Routes = [
  // 1) Root path shows new splash/home
  {
    path: '',
    component: HomeComponent,
  },

  // 2) The gather/analyze/deploy flow
  {
    path: 'gather',
    component: GatherDataComponent,
    children: [
      {
        path: 'analyze/:id',
        component: AnalyzeDataComponent,
        children: [
          {
            path: 'deploy/:modelId',
            loadComponent: () =>
              import('./visualize/visualize.component').then(
                (m) => m.VisualizeComponent
              ),
          },
        ],
      },
    ],
  },
  { path: 'error', component: ErrorComponent },
  // catch all—redirect back to home
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
