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

  it('uploads media as its original binary file instead of Base64 JSON', async () => {
    service.refreshSession().subscribe();
    http.expectOne('/api/admin/session').flush({
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
    const video = new File([new Uint8Array([0, 1, 2, 3])], 'new era.mp4', {
      type: 'video/mp4',
    });

    const upload = await service.uploadVideo(video);
    upload.subscribe();

    const request = http.expectOne(
      '/api/admin/media?fileName=new+era.mp4&kind=championship-video&altText=',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(video);
    expect(request.request.headers.get('Content-Type')).toBe('video/mp4');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf-value');
    request.flush({ asset: { publicUrl: '/uploads/video.mp4', mimeType: 'video/mp4' } });
  });
});
