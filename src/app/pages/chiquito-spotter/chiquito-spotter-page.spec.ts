import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { ChiquitoSpotterPage } from './chiquito-spotter-page';

describe('ChiquitoSpotterPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChiquitoSpotterPage],
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
                chiquitoSpotterUrl:
                  'https://www.patreon.com/candemor/posts/chiquitito-version-2-999999999',
                featuredChampionship: null,
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('shows six playable and transcribed product demos', () => {
    const fixture = TestBed.createComponent(ChiquitoSpotterPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const players = host.querySelectorAll<HTMLAudioElement>('.spotter-audio');

    expect(players).toHaveLength(6);
    expect(players[0].getAttribute('src')).toBe('/media/chiquito-spotter/POSFT.wav');
    expect(host.querySelectorAll('.spotter-demo-card blockquote')).toHaveLength(6);
    expect(host.textContent).toContain('El coche de delante lucha por posición');
    expect(host.querySelector('a[href="/chiquito-spotter#demo"]')).toBeTruthy();
    expect(
      host.querySelectorAll(
        'a[href="https://www.patreon.com/candemor/posts/chiquitito-version-2-999999999"]',
      ),
    ).toHaveLength(2);
  });

  it('pauses the other demos when one starts playing', () => {
    const fixture = TestBed.createComponent(ChiquitoSpotterPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const players = host.querySelectorAll<HTMLAudioElement>('.spotter-audio');
    const pause = vi.spyOn(players[0], 'pause');

    Object.defineProperty(players[0], 'paused', { configurable: true, value: false });
    players[1].dispatchEvent(new Event('play'));

    expect(pause).toHaveBeenCalledOnce();
  });
});
