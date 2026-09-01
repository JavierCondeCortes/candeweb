import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SetupInvitation } from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { CandeBrand } from '../../../shared/components/cande-brand/cande-brand';

type SetupAuthMode = 'login' | 'request' | 'invitation';

@Component({
  selector: 'app-setup-auth',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher, TranslatePipe, CandeBrand],
  templateUrl: './setup-auth.html',
})
export class SetupAuth implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly mode = this.route.snapshot.data['mode'] as SetupAuthMode;
  readonly loading = signal(this.mode !== 'request');
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal('');
  readonly requiresMfa = signal(false);
  readonly invitation = signal<SetupInvitation | null>(null);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    mfaCode: [''],
  });
  readonly requestForm = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
  });
  readonly invitationForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  ngOnInit(): void {
    if (this.mode === 'request') return;
    if (this.mode === 'invitation') {
      const token = this.route.snapshot.queryParamMap.get('token') ?? '';
      if (!token) {
        this.loading.set(false);
        this.errorMessage.set('La invitación no es válida.');
        return;
      }
      this.api
        .verifyInvitation(token)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: ({ invitation }) => this.invitation.set(invitation),
          error: (error) => this.errorMessage.set(setupError(error)),
        });
      return;
    }
    this.api
      .refreshSession()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (session) => {
          if (session.authenticated) void this.router.navigate(['/setups']);
        },
      });
  }

  login(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    const value = this.loginForm.getRawValue();
    this.api
      .login({
        email: value.email,
        password: value.password,
        mfaCode: value.mfaCode || undefined,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(returnUrl?.startsWith('/setups') ? returnUrl : '/setups');
        },
        error: (error) => {
          if (setupErrorCode(error) === 'MFA_REQUIRED') this.requiresMfa.set(true);
          this.errorMessage.set(setupError(error));
        },
      });
  }

  requestAccess(): void {
    this.requestForm.markAllAsTouched();
    if (this.requestForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .requestAccess(this.requestForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  acceptInvitation(): void {
    this.invitationForm.markAllAsTouched();
    if (this.invitationForm.invalid || this.submitting()) return;
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .acceptInvitation({ token, password: this.invitationForm.controls.password.value })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/setups']),
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }
}

function setupError(error: unknown): string {
  const message = (error as { error?: { error?: { message?: string } } })?.error?.error?.message;
  return message || 'No se pudo completar la operación.';
}

function setupErrorCode(error: unknown): string {
  return (error as { error?: { error?: { code?: string } } })?.error?.error?.code ?? '';
}
