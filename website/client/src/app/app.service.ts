import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface VisualizationItem {
  language: string;
  library: string;
  llm: string;
  code: string;
  image_url: string;
}

export interface UserStory {
  id: number;
  description: string;
  userstory: string;
  image_url: string;
  visualizations: VisualizationItem[];
}

@Injectable({
  providedIn: 'root',
})
export class AppService {
  private readonly apiUrl = 'http://localhost:8000/api/userstories';

  constructor(private http: HttpClient) {}

  getUserStories(id?: number): Observable<UserStory[]> {
    if (id !== undefined) {
      return this.http.get<UserStory[]>(`${this.apiUrl}/${id}`);
    }
    return this.http.get<UserStory[]>(this.apiUrl);
  }

  private readonly userStoryApiUrl = 'http://localhost:8000/api/userstory';

  getVisualizationsForUserStory(
    us_id: number
  ): Observable<VisualizationItem[]> {
    return this.http.get<VisualizationItem[]>(
      `${this.userStoryApiUrl}/${us_id}`
    );
  }
  generateVisualization(payload: {
    id: number;
    model: string;
    language: string;
    library: string;
    isDVL: boolean;
  }): Observable<any> {
    return this.http.post('http://localhost:8000/api/generate', payload);
  }
}
