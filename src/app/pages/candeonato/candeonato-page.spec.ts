import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { CandeonatoPage } from './candeonato-page';

describe('CandeonatoPage', () => {
  it('preserves the promotional page and exposes the history', async () => {
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
                featuredChampionship: null,
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandeonatoPage);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent).toContain('CANDEONATO');
    expect(host.querySelector('main#contenido')).toBeTruthy();

    const historyLink = host.querySelector<HTMLAnchorElement>(
      '.site-footer a[href="/candeonatos"]',
    );

    expect(historyLink).toBeTruthy();
    expect(historyLink?.textContent?.trim()).toBe('Historial de Candeonatos');

    const footerMark = host.querySelector<HTMLAnchorElement>(
      '[data-testid="footer-mark"]',
    );

    expect(footerMark).toBeTruthy();
    expect(footerMark?.getAttribute('aria-label')).toContain(
      footerMark?.textContent?.trim(),
    );
  });
});