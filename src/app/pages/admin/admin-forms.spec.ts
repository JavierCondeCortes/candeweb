import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminApiService } from '../../core/services/admin-api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { AdminChampionshipForm } from './admin-championship-form/admin-championship-form';
import { AdminMemberForm } from './admin-member-form/admin-member-form';
import { AdminSecurity } from './admin-security/admin-security';
import { AdminSponsorForm } from './admin-sponsor-form/admin-sponsor-form';
import { AdminSettings } from './admin-settings/admin-settings';
import { AdminEmailTemplate } from './admin-email-template/admin-email-template';

describe('Admin reactive forms', () => {
  it('renders the new member form with its controls connected', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMemberForm],
      providers: [
        provideRouter([]),
        { provide: AdminApiService, useValue: { session: () => null } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminMemberForm);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('input[formControlName="name"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('input[formControlName="photoConsentConfirmed"]'),
    ).toBeTruthy();
  });

  it('renders the new Candeonato form with its controls connected', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminChampionshipForm],
      providers: [
        provideRouter([]),
        { provide: AdminApiService, useValue: { session: () => null } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminChampionshipForm);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(
      fixture.nativeElement.querySelector('input[formControlName="externalTournamentId"]'),
    ).toBeTruthy();
  });

  it('renders the new sponsor form with publishing and accessible-logo controls', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSponsorForm],
      providers: [
        provideRouter([]),
        { provide: AdminApiService, useValue: { session: () => null } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminSponsorForm);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('input[formControlName="name"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="logoAlt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('select[formControlName="status"]')).toBeTruthy();
  });

  it('renders settings after loading their administered values', async () => {
    const api = {
      getSettings: () =>
        of({
          settings: {
            twitchChannelLogin: 'candemorracingteam',
            twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
            twitchChannels: [
              {
                login: 'candemorracingteam',
                url: 'https://www.twitch.tv/candemorracingteam',
                isOfficial: true,
                priority: 0,
              },
              {
                login: 'piloto_candemor',
                url: 'https://www.twitch.tv/piloto_candemor',
                isOfficial: false,
                priority: 1,
              },
            ],
            featuredChampionshipId: null,
            chiquitoSpotterUrl:
              'https://www.patreon.com/candemor/posts/chiquitito-151646382',
            contactEmail: null,
            discordUrl: 'https://discord.gg/j22XuDEfMk',
            instagramUrl: null,
            youtubeUrl: null,
            updatedAt: '2026-08-11T00:00:00.000Z',
          },
        }),
      getChampionships: () => of({ championships: [] }),
    };
    await TestBed.configureTestingModule({
      imports: [AdminSettings],
      providers: [{ provide: AdminApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('input[formControlName="twitchChannelLogin"]'),
    ).toBeTruthy();
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector<HTMLTextAreaElement>('textarea[formControlName="twitchChannelsText"]')
        ?.value,
    ).toBe('piloto_candemor');
    expect(
      host.querySelector<HTMLInputElement>('input[formControlName="chiquitoSpotterUrl"]')?.value,
    ).toBe('https://www.patreon.com/candemor/posts/chiquitito-151646382');
  });

  it('renders the editable invitation email and its isolated preview', async () => {
    const template = {
      templateKey: 'access-invitation' as const,
      subjectTemplate: 'Acceso para {{displayName}}',
      htmlTemplate:
        '<html><body><p>{{displayName}}</p><a href="{{confirmationUrl}}">Entrar</a><p>{{expiresAt}}</p></body></html>',
      css: 'body { background: #050505; color: #fff; }',
      textTemplate: '{{displayName}} {{confirmationUrl}} {{expiresAt}}',
      isCustom: false,
      updatedAt: null,
      updatedByName: null,
    };
    const api = {
      getAccessInvitationEmailTemplate: () =>
        of({ template, smtpConfigured: false, smtpIssue: null }),
      previewAccessInvitationEmail: () =>
        of({
          preview: {
            subject: 'Acceso para Alex Racing',
            html: '<html><body><p>Vista previa segura</p></body></html>',
            text: 'Vista previa segura',
          },
        }),
    };
    await TestBed.configureTestingModule({
      imports: [AdminEmailTemplate],
      providers: [{ provide: AdminApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminEmailTemplate);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('textarea[formControlName="htmlTemplate"]')).toBeTruthy();
    expect(host.querySelector('textarea[formControlName="css"]')).toBeTruthy();
    expect(host.querySelector('iframe[sandbox]')?.getAttribute('srcdoc')).toContain(
      'Vista previa segura',
    );
    expect(host.textContent).toContain('SMTP desactivado');
  });

  it('renders the second-factor security screen', async () => {
    const api = {
      session: () => ({
        admin: {
          id: 'admin-1',
          email: 'admin@candemor.test',
          displayName: 'Candemor',
          role: 'admin',
          mfaEnabled: false,
        },
      }),
    };
    await TestBed.configureTestingModule({
      imports: [AdminSecurity],
      providers: [{ provide: AdminApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminSecurity);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.textContent).toContain('Configurar ahora');
    expect(fixture.nativeElement.textContent).toContain('cambia cada 30 segundos');

    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Configure now');
    expect(fixture.nativeElement.textContent).toContain('changes every 30 seconds');
    i18n.setLanguage('es');
  });
});
