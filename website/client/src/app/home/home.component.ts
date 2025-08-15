import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HttpClientModule],
})
export class HomeComponent {
  cards = [
    { step: '1', title: 'Select a dataset', text: 'Choose a dataset from the Human Reference Atlas' },
    { step: '2', title: 'Select visualization', text: 'Choose an AI model, programming language, visualization library and type' },
    { step: '3', title: 'Optimize with AI', text: 'Edit the visualization, code, and deploy the results' },
  ];

  apiKey = '';
  showKey = false;

  constructor(private router: Router, private http: HttpClient) {}

  toggleKeyVisibility() {
    this.showKey = !this.showKey;
  }

  onGetStarted() {
    const key = (this.apiKey || '').trim();
    if (!key) {
      alert('Please enter your API key.');
      return;
    }

    this.http.post('http://localhost:8000/api/save-api-key', { api_key: key }).subscribe({
      next: () => {
        console.log('API key saved successfully');
        this.router.navigate(['/gather']);
      },
      error: err => {
        console.error('Failed to save API key', err);
        alert('Failed to save API key');
      }
    });
  }
}
