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
@Injectable({
  providedIn: 'root',
})
export class VisualizeService {
  private baseUrl = 'http://localhost:8000/api';
  constructor(private http: HttpClient) {}

  generateVisulization(payload: GenerateRequest): Observable<GenerateResponse> {
    return this.http.post<GenerateResponse>(
      `${this.baseUrl}/generate`,
      payload
    );
  }

  refineVisulization(refineText: string): Observable<string> {
    const payload = { refine: refineText };
    return this.http.post<string>(`${this.baseUrl}/refine`, payload);
  }

  downloadVisualization(filename: string): Observable<Blob> {
    const url = `${this.baseUrl}/download/${filename}`;
    return this.http.get(url, { responseType: 'blob' });
  }
}
