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
  category: string;
}

export interface RefinePrompt {
  keyword: string;
  description: string;
}

export interface RefineResponse {
  updated_code: string;
  output_path: string;
}

export interface HistoryItem {
  userText: string;
  code: string;
  time: Date;
  isDone: boolean;
  collapsed: boolean;
  model: string;
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
  // returns one story, not an array
  getUserStoryById(id: number): Observable<UserStory> {
    return this.http.get<UserStory>(`${this.apiUrl}/${id}`);
  }
  // to get refine prompts by user story id
  getRefinePrompts(usId: number): Observable<RefinePrompt[]> {
    return this.http.get<RefinePrompt[]>(
      `http://localhost:8000/api/refinements/${usId}`
    );
  }

  refineVisualization(prompt: string): Observable<RefineResponse> {
    return this.http.post<RefineResponse>('http://localhost:8000/api/refine', {
      prompt,
    });
  }
}
