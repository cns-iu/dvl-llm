import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface GenerateRequest {
  model: string;
  language: string;
  library: string;
  isDVL: boolean;
}

interface GenerateResponse {
  output_path: string;
  code: string;
}

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

export interface RefinePrompt {
  keyword: string;
  description: string;
}

export interface RefineResponse {
  updated_code: string;
  output_path: string;
}

@Injectable({
  providedIn: 'root',
})
export class VisualizeService {
  private readonly apiUrl = 'http://localhost:8000/api/userstories';
  private baseUrl = 'http://localhost:8000/api';
  constructor(private http: HttpClient) {}

  generateVisulization(payload: GenerateRequest): Observable<GenerateResponse> {
    return this.http.post<GenerateResponse>(
      `${this.baseUrl}/generate`,
      payload
    );
  }

  // // returns one story, not an array
  // getUserStoryById(id: number): Observable<UserStory> {
  //   return this.http.get<UserStory>(`${this.apiUrl}/${id}`);
  // }
  // // to get refine prompts by user story id
  // getRefinePrompts(usId: number): Observable<RefinePrompt[]> {
  //   return this.http.get<RefinePrompt[]>(
  //     `http://localhost:8000/api/refinements/${usId}`
  //   );
  // }

  downloadVisualization(filename: string): Observable<Blob> {
    const url = `${this.baseUrl}/download/${filename}`;
    return this.http.get(url, { responseType: 'blob' });
  }
  // refineVisualization(prompt: string): Observable<RefineResponse> {
  //   return this.http.post<RefineResponse>('http://localhost:8000/api/refine', {
  //     prompt,
  //   });
  // }
  undoVisualization(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/undo`, {});
  }
}
