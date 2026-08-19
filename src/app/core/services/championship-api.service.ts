import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  map,
  of,
  retry,
  shareReplay,
  tap,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import { TournamentApiResponse } from '../models/championship-api.model';
import { TournamentLoadResult } from '../models/championship.model';

export const CHAMPIONSHIP_API_BASE_URL = 'https://fatcatrace.xyz/api/torneo';
export const CHAMPIONSHIP_PUBLIC_BASE_URL = '/api/public/championships';
export const CHAMPIONSHIP_EDITION_IDS = [46, 42, 38, 36, 35, 34] as const;

@Injectable({ providedIn: 'root' })
export class ChampionshipApiService {
  private readonly http = inject(HttpClient);
  private readonly requests = new Map<number, Observable<TournamentLoadResult>>();
  private readonly lastValidResponses = new Map<number, TournamentLoadResult>();

  getTournament(tournamentId: number, refresh = false): Observable<TournamentLoadResult> {
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      return throwError(() => new Error('El identificador del Candeonato no es válido.'));
    }

    if (!refresh) {
      const cachedRequest = this.requests.get(tournamentId);
      if (cachedRequest) return cachedRequest;
    }

    const request = this.http
      .get<{
        data: TournamentApiResponse;
        syncedAt: string;
        corrections?: TournamentLoadResult['corrections'];
      }>(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/${tournamentId}/sports-data`)
      .pipe(
        map(({ data, syncedAt, corrections }) => ({
          response: data,
          isStale: false,
          syncedAt: syncedAt || new Date().toISOString(),
          source: 'snapshot' as const,
          corrections: corrections ?? [],
        })),
        catchError(() =>
          this.http.get<TournamentApiResponse>(`${CHAMPIONSHIP_API_BASE_URL}/${tournamentId}`).pipe(
            timeout(10_000),
            retry({ count: 1, delay: () => timer(500) }),
            map((response) => ({
              response,
              isStale: false,
              syncedAt: new Date().toISOString(),
              source: 'live' as const,
              corrections: [],
            })),
          ),
        ),
        tap((result) => this.lastValidResponses.set(tournamentId, result)),
        catchError((error: unknown) => {
          const lastValid = this.lastValidResponses.get(tournamentId);
          return lastValid
            ? of({ ...lastValid, isStale: true, source: 'memory' as const })
            : throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.requests.set(tournamentId, request);
    return request;
  }
}
