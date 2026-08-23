import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StreamStatusService } from '../../../../core/services/stream-status.service';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { HomeHero } from './home-hero';

describe('HomeHero', () => {
  let component: HomeHero;
  let fixture: ComponentFixture<HomeHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeHero],
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('explains the community with one heading and a useful Twitch fallback', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toContain('CANDEMOR');
    expect(host.textContent).toContain('CandemorRacingTeam');
    expect(host.querySelector<HTMLAnchorElement>('.stream-link')?.href).toBe(
      'https://www.twitch.tv/candemorracingteam',
    );
    expect(host.querySelectorAll('.control-button')).toHaveLength(3);
    expect(host.querySelector('source[src$="home-example-optimized.mp4"]')).toBeTruthy();
    expect(host.querySelector<HTMLAnchorElement>('.home-hero-actions .button-primary')?.hash).toBe(
      '#comunidad',
    );
  });

  it('closes the mobile menu and restores the interface with Escape', () => {
    const menuButton = fixture.nativeElement.querySelector(
      '.home-menu-button',
    ) as HTMLButtonElement;

    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    component.toggleMenu();
    fixture.detectChanges();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    component.toggleVideoFocus();
    fixture.detectChanges();

    expect(component.isVideoFocusMode()).toBe(true);
    expect(component.isMenuOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.home-nav')?.hasAttribute('inert')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isVideoFocusMode()).toBe(false);
    expect(component.isMenuOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.home-nav')?.hasAttribute('inert')).toBe(false);
  });

  it('signals an active event and links a finished event directly to its history', () => {
    fixture.componentRef.setInput('championship', championship('active'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const eventLink = host.querySelector<HTMLAnchorElement>('.home-nav-current-event');
    expect(eventLink?.getAttribute('href')).toBe('/candeonato');
    expect(eventLink?.querySelector('.home-nav-live-dot')).toBeTruthy();

    fixture.componentRef.setInput('championship', championship('finished'));
    fixture.detectChanges();

    expect(eventLink?.getAttribute('href')).toBe('/candeonatos/42');
    expect(eventLink?.querySelector('.home-nav-live-dot')).toBeNull();
  });
});

function championship(status: ChampionshipContent['status']): ChampionshipContent {
  return {
    id: 'current',
    externalTournamentId: 42,
    slug: 'current',
    name: 'Candeonato actual',
    editionNumber: 8,
    subtitle: null,
    season: null,
    summary: null,
    description: null,
    coverUrl: null,
    coverAlt: null,
    backgroundVideoUrl: null,
    backgroundVideoMimeType: null,
    startAt: null,
    endAt: null,
    registrationUrl: null,
    rulesUrl: null,
    status,
    isFeatured: true,
    displayOrder: 0,
    publishedAt: null,
    lastSyncedAt: null,
    syncStatus: 'never',
    syncError: null,
    createdAt: '',
    updatedAt: '',
  };
}
