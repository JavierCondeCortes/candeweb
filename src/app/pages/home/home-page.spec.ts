import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { StreamStatusService } from '../../core/services/stream-status.service';
import { HomePage } from './home-page';

describe('HomePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        {
          provide: StreamStatusService,
          useValue: {
            status$: of({
              kind: 'unconfigured',
              channelName: 'CandemorRacingTeam',
              channelUrl: 'https://www.twitch.tv/candemorracingteam',
            }),
          },
        },
        {
          provide: PublicContentService,
          useValue: {
            getMembers: () =>
              of({
                members: [
                  member('1', 'Alex Vega', true),
                  member('2', 'Lucía Torres', false),
                  member('3', 'Dani Romero', true),
                  member('4', 'Nora Ruiz', false),
                  member('5', 'Marcos León', true),
                ],
              }),
            getSiteSettings: () =>
              of({
                featuredChampionship: championship,
                discordUrl: 'https://discord.gg/j22XuDEfMk',
              }),
            getTwitchContent: () =>
              of({
                channel: {
                  id: '1234',
                  login: 'candemorracingteam',
                  displayName: 'CandemorRacingTeam',
                  description: 'Simracing y comunidad',
                  profileImageUrl: 'https://static-cdn.jtvnw.net/profile.png',
                  offlineImageUrl: 'https://static-cdn.jtvnw.net/offline.jpg',
                  url: 'https://www.twitch.tv/candemorracingteam',
                },
                clips: [
                  {
                    id: 'clip-id',
                    url: 'https://clips.twitch.tv/clip-id',
                    embedUrl: 'https://clips.twitch.tv/embed?clip=clip-id',
                    title: 'Final del Candeonato',
                    creatorName: 'CandemorFan',
                    thumbnailUrl: 'https://clips-media-assets2.twitch.tv/preview.jpg',
                    viewCount: 120,
                    createdAt: '2026-08-01T20:00:00Z',
                    durationSeconds: 28.4,
                  },
                ],
                fetchedAt: '2026-08-11T12:00:00.000Z',
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the MVP sections without unconfirmed sponsors or merchandise', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#comunidad')).toBeTruthy();
    expect(host.querySelector('#equipo')).toBeTruthy();
    expect(host.querySelector('#contenido')).toBeTruthy();
    expect(host.querySelector('#unirse')).toBeFalsy();
    expect(host.querySelectorAll('.team-card')).toHaveLength(5);
    expect(host.querySelectorAll('.team-card a')).toHaveLength(3);
    expect(host.querySelectorAll('.team-card')[1].querySelector('.team-card-socials')).toBeFalsy();
    expect(host.textContent).toContain('Cada cierto tiempo, Candemor organiza el Candeonato');
    expect(host.querySelector<HTMLImageElement>('.home-event-preview-media img')?.src).toContain(
      'current-edition.webp',
    );
    expect(host.querySelector('video.home-event-preview-media')).toBeNull();
    const expandPoster = host.querySelector<HTMLButtonElement>('.home-event-poster-expand');
    expect(expandPoster).toBeTruthy();
    expandPoster?.click();
    fixture.detectChanges();
    const posterDialog = host.querySelector<HTMLDialogElement>('.home-event-poster-dialog');
    expect(posterDialog?.hasAttribute('open')).toBe(true);
    host.querySelector<HTMLButtonElement>('.home-event-poster-dialog-close')?.click();
    fixture.detectChanges();
    expect(posterDialog?.hasAttribute('open')).toBe(false);
    expandPoster?.click();
    fixture.detectChanges();
    host.querySelector<HTMLElement>('.home-event-poster-dialog-content')?.click();
    fixture.detectChanges();
    expect(posterDialog?.hasAttribute('open')).toBe(false);
    const mediaButtons = host.querySelectorAll<HTMLButtonElement>(
      '.home-event-media-choice button',
    );
    expect(mediaButtons[0].getAttribute('aria-pressed')).toBe('true');
    mediaButtons[1].click();
    fixture.detectChanges();
    expect(host.querySelector<HTMLVideoElement>('.home-event-preview-media')?.poster).toContain(
      'current-edition.webp',
    );
    expect(
      host.querySelector<HTMLSourceElement>('.home-event-preview-media source')?.src,
    ).toContain('current-edition.mp4');
    expect(host.querySelector('.home-event-poster-expand')).toBeNull();
    expect(mediaButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(
      host.querySelector('.home-event-preview-meta [data-status="active"]')?.textContent,
    ).toContain('En curso');
    expect(host.querySelector('time[datetime="2026-09-04T18:00:00+02:00"]')).toBeTruthy();
    expect(host.querySelector('time[datetime="2026-09-06T20:00:00+02:00"]')).toBeTruthy();
    expect(host.textContent).toContain('Esto es Candemor');
    expect(host.textContent).toContain('Final del Candeonato');
    expect(host.querySelector('a[href="https://discord.gg/j22XuDEfMk"]')).toBeTruthy();
    expect(host.textContent).not.toContain('Patrocinadores');
    expect(host.textContent).not.toContain('Tienda');

    const footerLinks = Array.from(host.querySelectorAll<HTMLAnchorElement>('.home-footer nav a'));
    expect(footerLinks.map((link) => link.textContent?.trim())).toContain(
      'Historial de Candeonatos',
    );
    expect(footerLinks.some((link) => link.hash === '#comunidad')).toBe(false);
    expect(footerLinks.some((link) => link.hash === '#equipo')).toBe(false);
    expect(footerLinks.some((link) => link.hash === '#contenido')).toBe(false);
  });

  it('keeps the public home structure accessible and free of duplicate identifiers', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const ids = Array.from(host.querySelectorAll<HTMLElement>('[id]')).map((element) => element.id);
    const skipLink = host.querySelector<HTMLAnchorElement>('.skip-link');

    expect(new Set(ids).size).toBe(ids.length);
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(skipLink?.hash).toBe('#contenido-inicio');
    expect(host.querySelector(skipLink?.hash ?? 'invalid')).toBeTruthy();

    for (const image of host.querySelectorAll<HTMLImageElement>('img')) {
      expect(image.hasAttribute('alt')).toBe(true);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }

    for (const externalLink of host.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      expect(externalLink.rel.split(/\s+/)).toContain('noopener');
      expect(externalLink.getAttribute('aria-label')).toContain('pestaña nueva');
    }

    for (const brandLink of host.querySelectorAll<HTMLAnchorElement>('a.home-brand')) {
      expect(brandLink.getAttribute('aria-label')).toContain(brandLink.textContent?.trim());
    }
  });
});

const championship = {
  id: 'championship',
  externalTournamentId: 42,
  slug: 'candeonato-bandido',
  name: 'Candeonato Bandido',
  editionNumber: 8,
  subtitle: 'New Era Edition',
  season: '2026',
  summary:
    'Cada cierto tiempo, Candemor organiza el Candeonato: un campeonato con distintas carreras, posiciones y puntos.',
  description: null,
  coverUrl: '/media/current-edition.webp',
  coverMobileUrl: '/media/current-edition-mobile.webp',
  coverAlt: 'Mazda de competición',
  backgroundVideoUrl: '/media/current-edition.mp4',
  backgroundVideoMimeType: 'video/mp4',
  startAt: '2026-09-04T18:00:00+02:00',
  endAt: '2026-09-06T20:00:00+02:00',
  registrationUrl: null,
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

function member(id: string, name: string, withTwitch: boolean) {
  return {
    id,
    slug: name.toLowerCase().replace(' ', '-'),
    name,
    alias: null,
    roleLabel: null,
    bio: null,
    photoUrl: `/media/team/member-alex.webp`,
    photoAlt: `Retrato ficticio de ${name}`,
    twitchUrl: withTwitch ? 'https://www.twitch.tv/candemorracingteam' : null,
    instagramUrl: null,
    youtubeUrl: null,
    xUrl: null,
    displayOrder: Number(id),
    isFeatured: true,
    isDemo: true,
    status: 'published',
    publishedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}
