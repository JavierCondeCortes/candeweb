import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccessApiService } from '../../../core/services/access-api.service';
import { AccessAuth } from './access-auth';

describe('AccessAuth', () => {
  it('reveals the password and sends the persistent-session choice', async () => {
    let submitted: { rememberMe?: boolean } | null = null;
    const api = {
      session: () => null,
      refreshSession: () => of({ authenticated: false, account: null, csrfToken: null }),
      login: (input: { rememberMe?: boolean }) => {
        submitted = input;
        return of({
          authenticated: true,
          account: {
            id: 'user-1',
            email: 'piloto@candemor.test',
            displayName: 'Piloto',
            role: 'user',
            canAccessSetups: true,
            canUploadSetups: false,
            canAccessSkins: false,
            mfaEnabled: true,
          },
          csrfToken: 'csrf',
        });
      },
    };

    await TestBed.configureTestingModule({
      imports: [AccessAuth],
      providers: [
        provideRouter([{ path: 'setups', component: AccessAuth }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'login' },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: AccessApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AccessAuth);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const password = host.querySelector<HTMLInputElement>('#access-login-password');
    const visibilityButton = host.querySelector<HTMLButtonElement>(
      'button[aria-controls="access-login-password"]',
    );

    expect(password?.type).toBe('password');
    visibilityButton?.click();
    fixture.detectChanges();
    expect(password?.type).toBe('text');

    component.loginForm.setValue({
      email: 'piloto@candemor.test',
      password: 'password-piloto-123',
      mfaCode: '123456',
      rememberMe: true,
    });
    component.login();
    expect(submitted).toMatchObject({ rememberMe: true });
  });
});
