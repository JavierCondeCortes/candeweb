import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RoundResultsResponse } from '../models/round-results.model';

@Injectable({ providedIn: 'root' })
export class RoundResultsService {
  private readonly http = inject(HttpClient);

  getResults(sessionId: number) {
    return this.http.get<RoundResultsResponse>(`/api/public/rounds/${sessionId}/results`);
  }
}
