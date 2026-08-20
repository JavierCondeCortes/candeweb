import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SetupApiService } from './setup-api.service';

describe('SetupApiService', () => {
  let service: SetupApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SetupApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the private session and sends CSRF with binary setup uploads', () => {
    service.refreshSession().subscribe();
    http.expectOne('/api/setup-access/session').flush({
      authenticated: true,
      account: {
        id: 'admin-1',
        email: 'admin@candemor.test',
        displayName: 'Candemor',
        role: 'admin',
        canAccessSetups: true,
        canUploadSetups: true,
        mfaEnabled: true,
      },
      csrfToken: 'setup-csrf',
    });

    const setupFile = new File([new Uint8Array([1, 2, 3, 4])], "Spa driver's setup.sto", {
      type: 'application/octet-stream',
    });
    service
      .uploadFile('setup/id', setupFile, {
        sessionType: 'race_safe',
        notes: 'Versión estable',
        retentionDays: 90,
      })
      .subscribe();

    const request = http.expectOne(
      '/api/setups/setup%2Fid/files?fileName=Spa+driver%27s+setup.sto&sessionType=race_safe&notes=Versi%C3%B3n+estable&retentionDays=90',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(setupFile);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('setup-csrf');
    request.flush({ file: {}, setup: {} });
  });

  it('encodes management targets and protects permission changes with CSRF', () => {
    service.refreshSession().subscribe();
    http.expectOne('/api/setup-access/session').flush({
      authenticated: true,
      account: {
        id: 'owner-1',
        email: 'owner@candemor.test',
        displayName: 'Owner',
        role: 'owner',
        canAccessSetups: true,
        canUploadSetups: true,
        mfaEnabled: true,
      },
      csrfToken: 'owner-csrf',
    });

    service.updatePermissions('user/1', true, true).subscribe();
    const request = http.expectOne('/api/setup-access/users/user%2F1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ canAccessSetups: true, canUploadSetups: true });
    expect(request.request.headers.get('X-CSRF-Token')).toBe('owner-csrf');
    request.flush({ user: {} });
  });
});
