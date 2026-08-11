import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RoundResultsService } from '../../../../core/services/round-results.service';
import { RoundsList } from './rounds-list';

describe('RoundsList', () => {
  it('loads and exposes race positions only after an explicit action', async () => {
    const getResults = vi.fn(() =>
      of({
        sessionId: 82043333,
        results: [
          {
            position: 1,
            driverName: 'Andrea Real',
            team: 'Candemor',
            laps: 7,
            totalTime: '00:15:06.58',
            averageLap: '02:09.51',
            incidents: 1,
          },
        ],
        sourceUrl: 'https://fatcatrace.xyz/ronda/82043333',
        fetchedAt: '2026-08-11T12:00:00.000Z',
      }),
    );
    await TestBed.configureTestingModule({
      imports: [RoundsList],
      providers: [{ provide: RoundResultsService, useValue: { getResults } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(RoundsList);
    fixture.componentRef.setInput('groups', [
      {
        key: 'virginia',
        circuit: 'Virginia International Raceway',
        layout: 'Full Course',
        rounds: [
          {
            id: 326,
            externalSessionId: 82043333,
            number: 1,
            name: 'CANDEONATO - VIRGINIA',
            circuit: 'Virginia International Raceway',
            layout: 'Full Course',
            date: null,
            dateLabel: 'Fecha por confirmar',
            laps: 7,
            sof: 2346,
            isHeat: false,
            isTeamEvent: false,
            typeLabel: 'Carrera',
            receivedStatus: 'upcoming',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    expect(getResults).not.toHaveBeenCalled();
    const toggle = fixture.nativeElement.querySelector(
      '.round-results-toggle',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(getResults).toHaveBeenCalledWith(82043333);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('caption')?.textContent).toContain('La fuente no publica puntos');
    expect(host.querySelector('tbody')?.textContent).toContain('Andrea Real');
    expect(host.querySelector('a[target="_blank"]')?.getAttribute('rel')).toContain('noopener');
  });
});
