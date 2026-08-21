import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AdminInvitation } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-accept-invitation',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher, TranslatePipe],
  templateUrl: './admin-accept-invitation.html',
})
export class AdminAcceptInvitation implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly invitation = signal<AdminInvitation | null>(null);
  readonly errorMessage = signal('');
  readonly token = signal('');
  readonly passwordVisible = signal(false);
  readonly passwordConfirmationVisible = signal(false);
  readonly form = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
    passwordConfirmation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(token);
    if (!token) {
      this.loading.set(false);
      this.errorMessage.set(this.i18n.translate('admin.acceptInvitation.invalid'));
      return;
    }
    this.api
      .verifyInvitation(token)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ invitation }) => this.invitation.set(invitation),
        error: () => this.errorMessage.set(this.i18n.translate('admin.acceptInvitation.invalid')),
      });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const value = this.form.getRawValue();
    if (value.password !== value.passwordConfirmation) {
      this.errorMessage.set(this.i18n.translate('admin.acceptInvitation.passwordMismatch'));
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .acceptInvitation({ token: this.token(), password: value.password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/admin/seguridad']),
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  togglePasswordConfirmation(): void {
    this.passwordConfirmationVisible.update((visible) => !visible);
  }
}
