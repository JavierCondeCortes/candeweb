import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MfaSetup } from '../../../core/models/content-admin.model';
import { SetupInvitation } from '../../../core/models/setup.model';
import { AccessApiService } from '../../../core/services/access-api.service';

type AccessMode = 'login' | 'request' | 'invitation';

@Component({
  selector: 'app-access-auth',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher, TranslatePipe],
  templateUrl: './access-auth.html',
})
export class AccessAuth implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly mode = this.route.snapshot.data['mode'] as AccessMode;
  readonly loading = signal(this.mode !== 'request');
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal('');
  readonly invitation = signal<SetupInvitation | null>(null);
  readonly mfaSetup = signal<MfaSetup | null>(null);
  readonly recoveryCodes = signal<string[]>([]);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    mfaCode: ['', [Validators.required, Validators.minLength(6)]],
  });
  readonly requestForm = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
  });
  readonly invitationForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
  });
  readonly mfaForm = this.formBuilder.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
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
      this.api.verifyInvitation(token).pipe(finalize(() => this.loading.set(false))).subscribe({
        next: ({ invitation }) => this.invitation.set(invitation),
        error: (error) => this.errorMessage.set(accessError(error)),
      });
      return;
    }
    this.api.refreshSession().pipe(finalize(() => this.loading.set(false))).subscribe({
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
    this.api.login(this.loginForm.getRawValue()).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => void this.navigateToAuthorizedArea(),
      error: (error) => this.errorMessage.set(accessError(error)),
    });
  }

  requestAccess(): void {
    this.requestForm.markAllAsTouched();
    if (this.requestForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api.requestAccess(this.requestForm.getRawValue()).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => this.sent.set(true),
      error: (error) => this.errorMessage.set(accessError(error)),
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
      .pipe(
        switchMap(() => this.api.startMfaSetup()),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (setup) => this.mfaSetup.set(setup),
        error: (error) => this.errorMessage.set(accessError(error)),
      });
  }

  confirmMfa(): void {
    this.mfaForm.markAllAsTouched();
    if (this.mfaForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api.confirmMfa(this.mfaForm.controls.code.value).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: ({ recoveryCodes }) => this.recoveryCodes.set(recoveryCodes),
      error: (error) => this.errorMessage.set(accessError(error)),
    });
  }

  continueAfterSetup(): void {
    void this.api.refreshSession().subscribe({ next: () => void this.navigateToAuthorizedArea() });
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
