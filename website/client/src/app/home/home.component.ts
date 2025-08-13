import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class HomeComponent {
  cards = [
    {
      step: '1',
      title: 'Select a dataset',
      text: 'Choose a dataset from the Human Reference Atlas',
    },
    {
      step: '2',
      title: 'Select visualization',
      text: 'Choose an AI model, programming language, visualization library and type',
    },
    {
      step: '3',
      title: 'Optimize with AI',
      text: 'Edit the visualization, code, and deploy the results',
    },
  ];

  constructor(private router: Router) {}

  onGetStarted() {
    this.router.navigate(['/gather']);
  }
}

// import { Component } from '@angular/core';
// @Component({
//   selector: 'app-home',
//   imports: [],
//   templateUrl: './home.component.html',
//   styleUrl: './home.component.css'
// })
// export class HomeComponent {

// }
