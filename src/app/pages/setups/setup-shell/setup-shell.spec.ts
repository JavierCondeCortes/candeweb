import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { SetupShell } from './setup-shell';

describe('SetupShell', () => {
  let fixture: ComponentFixture<SetupShell>;

  beforeEach(async () => {
    const session = signal({
      authenticated: true,
      account: {
        id: 'user-1',
        email: 'pilot@candemor.test',
        displayName: 'Piloto Candemor',
        role: 'user' as const,
        canAccessSetups: true,
        canUploadSetups: false,
        canAccessSkins: true,
        mfaEnabled: false,
      },
      csrfToken: 'csrf',
    });

    await TestBed.configureTestingModule({
      imports: [SetupShell],
      providers: [
        provideRouter([]),
        {
          provide: SetupApiService,
          useValue: {
            session: session.asReadonly(),
            logout: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupShell);
    fixture.detectChanges();
  });

  it('places the language switch immediately before the mobile menu button', () => {
    const actions = fixture.nativeElement.querySelector('.setup-account') as HTMLElement;
    const language = actions.querySelector('app-language-switcher');
    const menuButton = actions.querySelector('.setup-menu-button');

    expect(language).toBeTruthy();
    expect(menuButton).toBeTruthy();
    expect(
      Boolean(
        language!.compareDocumentPosition(menuButton!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('shows both private libraries when the account has both permissions', () => {
    const host = fixture.nativeElement as HTMLElement;
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.setup-nav a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(links).toContain('/setups');
    expect(links).toContain('/skins');
  });

  it('opens the mobile navigation and closes it with Escape', () => {
    const menuButton = fixture.nativeElement.querySelector(
      '.setup-menu-button',
    ) as HTMLButtonElement;

    menuButton.click();
    fixture.detectChanges();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.setup-nav').classList).toContain('is-open');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });
});
