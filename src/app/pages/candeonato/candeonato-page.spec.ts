import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { ChampionshipContent } from '../../core/models/content-admin.model';
import { CandeonatoPage } from './candeonato-page';

describe('CandeonatoPage', () => {
  async function render(featuredChampionship: ChampionshipContent | null) {
    await TestBed.configureTestingModule({
      imports: [CandeonatoPage],
      providers: [
        provideRouter([]),
        {
          provide: PublicContentService,
          useValue: {
            getSiteSettings: () =>
              of({
                twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
                discordUrl: 'https://discord.gg/j22XuDEfMk',
                contactEmail: null,
                featuredChampionship,
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandeonatoPage);
    await fixture.whenStable();
    return fixture;
  }

  it('preserves the promotional page and exposes the history', async () => {
    const fixture = await render(null);

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent).toContain('CANDEONATO');
    expect(host.querySelector('main#contenido')).toBeTruthy();

    const historyLink = host.querySelector<HTMLAnchorElement>(
      '.site-footer a[href="/candeonatos"]',
    );

    expect(historyLink).toBeTruthy();
    expect(historyLink?.textContent?.trim()).toBe('Historial de Candeonatos');

    const footerMark = host.querySelector<HTMLAnchorElement>('[data-testid="footer-mark"]');

    expect(footerMark).toBeTruthy();
    expect(footerMark?.getAttribute('aria-label')).toContain(footerMark?.textContent?.trim());
  });

  it('removes the registration form while the featured edition is active', async () => {
    const fixture = await render(activeChampionship);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-form-inscription')).toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('.button-live')?.href).toBe(
      'https://www.twitch.tv/candemorracingteam',
    );
  });

  it('keeps the current registration experience while registrations are open', async () => {
    const fixture = await render({ ...activeChampionship, status: 'registration' });
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-form-inscription')).toBeTruthy();
    expect(host.querySelector<HTMLAnchorElement>('.hero-actions .button-primary')?.hash).toBe(
      '#inscripcion',
    );
    expect(host.querySelector('.button-live')).toBeNull();
  });
});

const activeChampionship: ChampionshipContent = {
  id: 'active-edition',
  externalTournamentId: 42,
  slug: 'active-edition',
  name: 'Candeonato activo',
  editionNumber: 8,
  subtitle: null,
  season: '2026',
  summary: null,
  description: null,
  coverUrl: null,
  coverAlt: null,
  backgroundVideoUrl: null,
  backgroundVideoMimeType: null,
  startAt: '2026-09-04T18:00:00+02:00',
  endAt: null,
  registrationUrl: 'https://forms.gle/example',
  rulesUrl: null,
  status: 'active',
  isFeatured: true,
  displayOrder: 0,
  publishedAt: null,
  lastSyncedAt: null,
  syncStatus: 'never',
  syncError: null,
  createdAt: '',
  updatedAt: '',
};
