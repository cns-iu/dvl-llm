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
  url: string;
  code: string;
}
@Injectable({
  providedIn: 'root',
})
export class VisualizeService {
  private baseUrl = 'http://localhost:3000';
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
}
