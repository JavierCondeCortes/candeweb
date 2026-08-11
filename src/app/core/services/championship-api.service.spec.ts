import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TournamentApiResponse } from '../models/championship-api.model';
import {
  CHAMPIONSHIP_API_BASE_URL,
  CHAMPIONSHIP_PUBLIC_BASE_URL,
  ChampionshipApiService,
} from './championship-api.service';

describe('ChampionshipApiService', () => {
  let service: ChampionshipApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChampionshipApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads a tournament and reuses the request cache', () => {
    const response = { torneo: { id: 42 } } as TournamentApiResponse;
    let firstResult: number | undefined;
    let secondResult: number | undefined;
    let correctionCount = 0;

    service.getTournament(42).subscribe((result) => {
      firstResult = result.response.torneo.id;
      correctionCount = result.corrections.length;
    });
    const request = httpTesting.expectOne(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/42/sports-data`);
    request.flush({
      data: response,
      syncedAt: '2026-08-11T12:00:00.000Z',
      corrections: [
        {
          id: 'correction-1',
          reason: 'Resultado revisado',
          note: 'Aclaración editorial',
          createdByName: 'Dirección de carrera',
          createdAt: '2026-08-11T13:00:00.000Z',
        },
      ],
    });

    service.getTournament(42).subscribe((result) => (secondResult = result.response.torneo.id));

    expect(firstResult).toBe(42);
    expect(secondResult).toBe(42);
    expect(correctionCount).toBe(1);
    httpTesting.expectNone(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/42/sports-data`);
  });

  it('rejects invalid tournament identifiers before making a request', () => {
    let receivedError: unknown;
    service
      .getTournament(Number.NaN)
      .subscribe({ error: (error: unknown) => (receivedError = error) });
    expect(receivedError).toBeInstanceOf(Error);
    httpTesting.expectNone(() => true);
  });

  it('returns the last valid response if a refresh fails', async () => {
    const response = { torneo: { id: 42 } } as TournamentApiResponse;
    service.getTournament(42).subscribe();
    httpTesting
      .expectOne(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/42/sports-data`)
      .flush({ data: response });

    const refreshResult = firstValueFrom(service.getTournament(42, true));
    httpTesting
      .expectOne(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/42/sports-data`)
      .flush('Sin snapshot', { status: 404, statusText: 'Not Found' });
    httpTesting
      .expectOne(`${CHAMPIONSHIP_API_BASE_URL}/42`)
      .flush('Servidor no disponible', { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 550));
    httpTesting
      .expectOne(`${CHAMPIONSHIP_API_BASE_URL}/42`)
      .flush('Servidor no disponible', { status: 503, statusText: 'Unavailable' });

    expect((await refreshResult).isStale).toBe(true);
  });

  it('falls back to the external API while a snapshot is not available', () => {
    const response = { torneo: { id: 42 } } as TournamentApiResponse;
    let result: TournamentApiResponse | undefined;

    service.getTournament(42).subscribe((value) => (result = value.response));
    httpTesting
      .expectOne(`${CHAMPIONSHIP_PUBLIC_BASE_URL}/42/sports-data`)
      .flush('Sin snapshot', { status: 404, statusText: 'Not Found' });
    httpTesting.expectOne(`${CHAMPIONSHIP_API_BASE_URL}/42`).flush(response);

    expect(result?.torneo.id).toBe(42);
  });
});
