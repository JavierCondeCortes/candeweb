import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminLogin } from './admin-login';

describe('AdminLogin', () => {
  it('creates the first administrator when the database has no users', async () => {
    let submitted: Record<string, string> | null = null;
    const api = {
      refreshSession: () =>
        of({ authenticated: false, needsSetup: true, admin: null, csrfToken: null }),
      setup: (input: Record<string, string>) => {
        submitted = input;
        return of({
          authenticated: true,
          needsSetup: false,
          admin: {
            id: 'admin-1',
            email: input['email'],
            displayName: input['displayName'],
            role: 'admin',
          },
          csrfToken: 'csrf',
        });
      },
      login: () => of(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLogin],
      providers: [
        provideRouter([
          { path: 'admin', component: AdminLogin },
          { path: 'admin/seguridad', component: AdminLogin },
        ]),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLogin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Crear primera cuenta',
    );
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLInputElement>('input[formControlName="password"]')
        ?.getAttribute('autocomplete'),
    ).toBe('new-password');
    component.form.setValue({
      displayName: 'Administración Candemor',
      email: 'admin@candemor.test',
      password: 'password-segura-123',
      setupToken: '',
      mfaCode: '',
      rememberMe: false,
    });
    component.submit();

    expect(submitted).toMatchObject({
      email: 'admin@candemor.test',
      displayName: 'Administración Candemor',
    });
  });

  it('can reveal the password and sends the persistent-session choice', async () => {
    let submitted: { rememberMe?: boolean } | null = null;
    const api = {
      refreshSession: () =>
        of({ authenticated: false, needsSetup: false, admin: null, csrfToken: null }),
      login: (input: { rememberMe?: boolean }) => {
        submitted = input;
        return of({
          authenticated: true,
          needsSetup: false,
          admin: {
            id: 'admin-1',
            email: 'admin@candemor.test',
            displayName: 'Candemor',
            role: 'admin',
            mfaEnabled: true,
          },
          csrfToken: 'csrf',
        });
      },
      setup: () => of(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLogin],
      providers: [provideRouter([{ path: 'admin', component: AdminLogin }]), { provide: AdminApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLogin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const password = host.querySelector<HTMLInputElement>('#admin-login-password');
    const visibilityButton = host.querySelector<HTMLButtonElement>(
      'button[aria-controls="admin-login-password"]',
    );

    expect(password?.type).toBe('password');
    visibilityButton?.click();
    fixture.detectChanges();
    expect(password?.type).toBe('text');

    component.form.patchValue({
      email: 'admin@candemor.test',
      password: 'password-segura-123',
      rememberMe: true,
    });
    component.submit();
    expect(submitted).toMatchObject({ rememberMe: true });
  });
});
