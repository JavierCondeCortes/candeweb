import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorCode, apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher, TranslatePipe],
  templateUrl: './admin-login.html',
})
export class AdminLogin implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly needsSetup = signal(false);
  readonly errorMessage = signal('');
  readonly requiresMfa = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
    setupToken: [''],
    mfaCode: [''],
  });

  ngOnInit(): void {
    this.api
      .refreshSession()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (session) => {
          if (session.authenticated) void this.router.navigate(['/admin']);
          else this.needsSetup.set(session.needsSetup);
        },
        error: () => this.errorMessage.set(this.i18n.translate('admin.login.connectionError')),
      });
  }

  submit(): void {
    this.errorMessage.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    const value = this.form.getRawValue();
    const request = this.needsSetup()
      ? this.api.setup(value)
      : this.api.login({
          email: value.email,
          password: value.password,
          mfaCode: value.mfaCode || undefined,
        });
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (session) => {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const target =
          session.admin && !session.admin.mfaEnabled
            ? '/admin/seguridad'
            : requested?.startsWith('/admin')
              ? requested
              : '/admin';
        void this.router.navigateByUrl(target);
      },
      error: (error) => {
        if (apiErrorCode(error) === 'MFA_REQUIRED') this.requiresMfa.set(true);
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        );
      },
    });
  }
}
