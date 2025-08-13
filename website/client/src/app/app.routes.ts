import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component'; // ← your new homepage
import { GatherDataComponent } from './gather-data/gather-data.component';
import { AnalyzeDataComponent } from './analyze-data/analyze-data.component';

export const routes: Routes = [
  // 1) Root path shows your new splash/home
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

  // 3) (optional) catch all—redirect back to home
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];

//v1//
// import { Routes } from '@angular/router';
// import { GatherDataComponent } from './gather-data/gather-data.component';
// import { AnalyzeDataComponent } from './analyze-data/analyze-data.component';

// export const routes: Routes = [
//   {
//     path: '',
//     redirectTo: 'gather',
//     pathMatch: 'full',
//   },
//   {
//     path: 'gather',
//     component: GatherDataComponent,
//     children: [
//       {
//         path: 'analyze/:id',
//         component: AnalyzeDataComponent,
//         children: [
//           {
//             path: 'deploy/:modelId',
//             loadComponent: () =>
//               import('./visualize/visualize.component').then(
//                 (m) => m.VisualizeComponent
//               ),
//           },
//         ],
//       },
//     ],
//   },
// ];

//v2//

// import { Routes } from '@angular/router';
// import { GatherDataComponent } from './gather-data/gather-data.component';
// import { AnalyzeDataComponent } from './analyze-data/analyze-data.component';
// import { DvlFrameworkComponent } from './dvl-framework/dvl-framework.component';
// import { VisualizeComponent } from './visualize/visualize.component';

// export const routes: Routes = [
//   { path: '', redirectTo: 'gather', pathMatch: 'full' },
//   {
//     path: 'gather',
//     component: GatherDataComponent,
//     children: [
//       {
//         path: 'analyze/:id',
//         component: AnalyzeDataComponent,
//         children: [{ path: 'deploy/:modelId', component: VisualizeComponent }],
//       },
//     ],
//   },
//   // { path: 'dvl', component: DvlFrameworkComponent },
//   // { path: 'deploy', component: VisualizeComponent },
// ];
