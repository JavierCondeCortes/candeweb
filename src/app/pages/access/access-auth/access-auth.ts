import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SetupInvitation } from '../../../core/models/setup.model';
import { AccessApiService } from '../../../core/services/access-api.service';
import { CandeBrand } from '../../../shared/components/cande-brand/cande-brand';

type AccessMode = 'login' | 'request' | 'invitation' | 'forgot' | 'reset';

@Component({
  selector: 'app-access-auth',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher, TranslatePipe, CandeBrand],
  templateUrl: './access-auth.html',
})
export class AccessAuth implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  readonly mode = this.route.snapshot.data['mode'] as AccessMode;
  readonly loading = signal(!['request', 'forgot'].includes(this.mode));
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal('');
  readonly invitation = signal<SetupInvitation | null>(null);
  readonly mfaRequired = signal(false);
  readonly resetEmail = signal('');
  readonly resetDone = signal(false);
  readonly loginPasswordVisible = signal(false);
  readonly invitationPasswordVisible = signal(false);
  readonly resetPasswordVisible = signal(false);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    rememberMe: [false],
    mfaCode: [''],
  });
  readonly requestForm = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
  });
  readonly invitationForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
  });
  readonly forgotForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  readonly resetForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  ngOnInit(): void {
    if (this.mode === 'request' || this.mode === 'forgot') return;
    if (this.mode === 'reset') {
      const token = this.route.snapshot.queryParamMap.get('token') ?? '';
      if (!token) {
        this.loading.set(false);
        this.errorMessage.set(this.i18n.translate('home.access.resetInvalid'));
        return;
      }
      this.api
        .verifyPasswordReset(token)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: ({ email }) => this.resetEmail.set(email),
          error: () => this.errorMessage.set(this.i18n.translate('home.access.resetInvalid')),
        });
      return;
    }
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
          error: (error) => this.errorMessage.set(accessError(error)),
        });
      return;
    }
    this.api
      .refreshSession()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (session) => {
          if (session.authenticated) void this.navigateToAuthorizedArea();
        },
      });
  }

  login(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.navigateToAuthorizedArea(),
        error: (error) => {
          const code = accessErrorCode(error);
          // El código TOTP o de recuperación solo se pide a owner y admin: el servidor lo exige
          // y, solo entonces, el formulario muestra el campo.
          if (code === 'MFA_REQUIRED') {
            this.mfaRequired.set(true);
            this.errorMessage.set(this.i18n.translate('home.access.mfaRequired'));
          } else {
            if (code === 'INVALID_MFA_CODE') this.mfaRequired.set(true);
            this.errorMessage.set(accessError(error));
          }
        },
      });
  }

  requestPasswordReset(): void {
    this.forgotForm.markAllAsTouched();
    if (this.forgotForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .forgotPassword(this.forgotForm.controls.email.value)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (error) => this.errorMessage.set(accessError(error)),
      });
  }

  submitPasswordReset(): void {
    this.resetForm.markAllAsTouched();
    if (this.resetForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .resetPassword({
        token: this.route.snapshot.queryParamMap.get('token') ?? '',
        password: this.resetForm.controls.password.value,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.resetDone.set(true),
        error: (error) => this.errorMessage.set(accessError(error)),
      });
  }

  toggleResetPassword(): void {
    this.resetPasswordVisible.update((visible) => !visible);
  }

  toggleLoginPassword(): void {
    this.loginPasswordVisible.update((visible) => !visible);
  }

  toggleInvitationPassword(): void {
    this.invitationPasswordVisible.update((visible) => !visible);
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
        error: (error) =>
          this.errorMessage.set(
            accessErrorCode(error) === 'ACCOUNT_EXISTS'
              ? this.i18n.translate('home.access.accountExists')
              : accessError(error),
          ),
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
        next: () => void this.navigateToAuthorizedArea(),
        error: (error) => this.errorMessage.set(accessError(error)),
      });
  }

  private navigateToAuthorizedArea(): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const account = this.api.session()?.account;
    if (requested?.startsWith('/skins') && account?.canAccessSkins) {
      void this.router.navigateByUrl(requested);
    } else if (requested?.startsWith('/setups') && account?.canAccessSetups) {
      void this.router.navigateByUrl(requested);
    } else if (account?.canAccessSkins) {
      void this.router.navigate(['/skins']);
    } else if (account?.canAccessSetups) {
      void this.router.navigate(['/setups']);
    } else {
      void this.router.navigate(['/']);
    }
  }
}

function accessError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo completar la operación.'
  );
}

function accessErrorCode(error: unknown): string {
  return (error as { error?: { error?: { code?: string } } })?.error?.error?.code ?? '';
}
