import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { ChampionshipHistoryPage } from './championship-history-page';

describe('ChampionshipHistoryPage', () => {
  it('introduces the archive and links to the available edition', async () => {
    await TestBed.configureTestingModule({
      imports: [ChampionshipHistoryPage],
      providers: [
        provideRouter([]),
        {
          provide: PublicContentService,
          useValue: {
            getChampionships: () =>
              of({
                championships: [
                  {
                    id: '42',
                    externalTournamentId: 42,
                    editionNumber: 8,
                    name: 'Candeonato Bandido',
                    summary: 'Edición de prueba',
                    coverUrl: '/media/current-edition.webp',
                    coverAlt: 'Cartel de la edición de prueba',
                    status: 'active',
                    syncStatus: 'success',
                  },
                ],
              }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChampionshipHistoryPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toContain('Historial');
    expect(host.querySelector('a[href="/candeonatos/42"]')).toBeTruthy();
    expect(host.querySelector('.edition-index')).toBeFalsy();
    expect(host.querySelector<HTMLImageElement>('.edition-cover img')?.src).toContain(
      'current-edition.webp',
    );

    const brand = host.querySelector<HTMLAnchorElement>('a.archive-brand');
    expect(brand?.getAttribute('aria-label')).toContain(brand?.textContent?.trim());
  });
});
