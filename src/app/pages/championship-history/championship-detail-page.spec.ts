import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TournamentApiResponse } from '../../core/models/championship-api.model';
import { ChampionshipApiService } from '../../core/services/championship-api.service';
import { PublicContentService } from '../../core/services/public-content.service';
import { RoundResultsService } from '../../core/services/round-results.service';
import { ChampionshipDetailPage } from './championship-detail-page';

const response = {
  torneo: {
    id: 42,
    nombre: 'Candeonato Bandido',
    season: null,
    title_sponsor: null,
    heat_racing: 1,
    safety: 1,
    multiclass: 0,
    driver_change: 0,
  },
  rondas: [
    {
      id: 326,
      torneo_id: 42,
      iracing_id: 82043333,
      nombre: 'CANDEONATO - VIRGINIA',
      ronda_no: 1,
      circuito: 'Virginia International Raceway',
      variante: 'Full Course',
      fecha: null,
      sof: 2346,
      team_event: 0,
      laps: 7,
      is_heat: 0,
      status_label: 'upcoming',
    },
  ],
  entryList: [],
  teams: [],
  organizer: { id: 0, name: 'Candemor Racing Team' },
  schedule: [],
  pPe: [],
  pPd: [
    {
      piloto_id: 801380,
      torneo_id: 42,
      puntos_totales: '165.0000',
      rondas: 6,
      suma_posiciones: '15',
      total_incidents: '33',
      total_laps: '54',
      total_warnings: '0',
      victorias: 1,
      podios: 4,
      top_5: 5,
      top_10: 6,
      vueltas_rapidas: 1,
      poles: 0,
      custom_team: null,
    },
  ],
  transfers: [],
  sanciones: [],
  totalInscritos: 0,
  totalVueltas: '1357',
  totalIncidentes: '1292',
  totalPuntosdeLicencia: '0',
} as unknown as TournamentApiResponse;

describe('ChampionshipDetailPage', () => {
  it('renders normalized data from the requested tournament', async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionshipDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ torneoId: '42' })) },
        },
        {
          provide: ChampionshipApiService,
          useValue: {
            getTournament: () =>
              of({
                response,
                isStale: false,
                syncedAt: '2026-08-11T12:00:00.000Z',
                source: 'snapshot',
                corrections: [
                  {
                    id: 'correction-1',
                    reason: 'Incidencia revisada',
                    note: 'El resultado externo se conserva sin cambios.',
                    createdByName: 'Dirección de carrera',
                    createdAt: '2026-08-11T13:00:00.000Z',
                  },
                ],
              }),
          },
        },
        {
          provide: PublicContentService,
          useValue: {
            getChampionships: () =>
              of({
                championships: [
                  {
                    id: 'championship-42',
                    externalTournamentId: 42,
                    name: 'Candeonato Bandido',
                  },
                ],
              }),
            getSiteSettings: () => of({ featuredChampionship: null }),
          },
        },
        {
          provide: RoundResultsService,
          useValue: { getResults: () => of({ results: [] }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChampionshipDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.textContent).toContain('Candeonato Bandido');
    expect(host.querySelector('.standings-section')).toBeTruthy();
    expect(host.querySelectorAll('.stats-grid .stat-value')).toHaveLength(5);
    expect(host.querySelector('.round-card')?.textContent).toContain(
      'Virginia International Raceway',
    );
    expect(host.textContent).toContain('Incidencia revisada');
    expect(host.querySelector<HTMLSelectElement>('#edition-select')?.value).toBe('42');

    const brand = host.querySelector<HTMLAnchorElement>('a.detail-brand');
    expect(brand?.getAttribute('aria-label')).toContain(brand?.textContent?.trim());

    for (const group of host.querySelectorAll<HTMLElement>(
      '.stats-grid > div, .leaders-grid > div',
    )) {
      expect(
        Array.from(group.children).every((child) => ['DT', 'DD'].includes(child.tagName)),
      ).toBe(true);
    }
  });

  it('offers a retry action when the source is unavailable', async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionshipDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ torneoId: '42' })) },
        },
        {
          provide: ChampionshipApiService,
          useValue: { getTournament: () => throwError(() => new Error('offline')) },
        },
        {
          provide: PublicContentService,
          useValue: {
            getChampionships: () => of({ championships: [] }),
            getSiteSettings: () => of({ featuredChampionship: null }),
          },
        },
        {
          provide: RoundResultsService,
          useValue: { getResults: () => of({ results: [] }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChampionshipDetailPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(host.querySelector<HTMLButtonElement>('.error-actions button')?.textContent).toContain(
      'Reintentar',
    );
  });
});
