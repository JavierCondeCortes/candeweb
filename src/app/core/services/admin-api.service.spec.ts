import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the session and sends its CSRF token with mutations', () => {
    service.refreshSession().subscribe();
    const sessionRequest = http.expectOne('/api/admin/session');
    expect(sessionRequest.request.withCredentials).toBe(true);
    sessionRequest.flush({
      authenticated: true,
      needsSetup: false,
      admin: {
        id: 'admin-1',
        email: 'admin@candemor.test',
        displayName: 'Candemor',
        role: 'admin',
      },
      csrfToken: 'csrf-value',
    });

    service
      .updateSettings({
        twitchChannelLogin: 'candemorracingteam',
        twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
        twitchChannels: [
          {
            login: 'candemorracingteam',
            url: 'https://www.twitch.tv/candemorracingteam',
            isOfficial: true,
            priority: 0,
          },
        ],
        featuredChampionshipId: null,
        contactEmail: null,
        discordUrl: 'https://discord.gg/j22XuDEfMk',
        instagramUrl: null,
        youtubeUrl: null,
        updatedAt: '',
      })
      .subscribe();

    const mutation = http.expectOne('/api/admin/settings');
    expect(mutation.request.method).toBe('PATCH');
    expect(mutation.request.headers.get('X-CSRF-Token')).toBe('csrf-value');
    mutation.flush({ settings: mutation.request.body });

    service.logout().subscribe();
    const logout = http.expectOne('/api/admin/logout');
    expect(logout.request.method).toBe('POST');
    expect(logout.request.headers.get('X-CSRF-Token')).toBe('csrf-value');
    logout.flush(null);
  });
});
