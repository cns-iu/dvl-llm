import { Routes } from '@angular/router';
import { GatherDataComponent } from './gather-data/gather-data.component';
import { AnalyzeDataComponent } from './analyze-data/analyze-data.component';
import { DvlFrameworkComponent } from './dvl-framework/dvl-framework.component';
import { VisualizeComponent } from './visualize/visualize.component';

export const routes: Routes = [
  { path: '', redirectTo: 'gather', pathMatch: 'full' },
  {
    path: 'gather',
    component: GatherDataComponent,
    children: [
      {
        path: 'analyze/:id',
        component: AnalyzeDataComponent,
        children: [{ path: 'deploy/:modelId', component: VisualizeComponent }],
      },
    ],
  },
  // { path: 'dvl', component: DvlFrameworkComponent },
  // { path: 'deploy', component: VisualizeComponent },
];
