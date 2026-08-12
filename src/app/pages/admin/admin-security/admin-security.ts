import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MfaSetup } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-security',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './admin-security.html',
})
export class AdminSecurity {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  readonly session = this.api.session;
  readonly setup = signal<MfaSetup | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly loading = signal(false);
  readonly confirming = signal(false);
  readonly message = signal('');
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  startSetup(): void {
    this.loading.set(true);
    this.message.set('');
    this.errorMessage.set('');
    this.recoveryCodes.set([]);
    this.api
      .startMfaSetup()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (setup) => {
          this.setup.set(setup);
          this.form.reset();
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.confirming()) return;
    this.confirming.set(true);
    this.errorMessage.set('');
    this.api
      .confirmMfa(this.form.controls.code.value)
      .pipe(finalize(() => this.confirming.set(false)))
      .subscribe({
        next: ({ recoveryCodes }) => {
          this.recoveryCodes.set(recoveryCodes);
          this.setup.set(null);
          this.message.set(this.i18n.translate('admin.security.activatedMessage'));
          this.api.refreshSession().subscribe();
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  async copySecret(): Promise<void> {
    const secret = this.setup()?.secret;
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    this.message.set(this.i18n.translate('admin.security.secretCopied'));
  }

  async copyRecoveryCodes(): Promise<void> {
    const codes = this.recoveryCodes();
    if (!codes.length) return;
    await navigator.clipboard.writeText(codes.join('\n'));
    this.message.set(this.i18n.translate('admin.security.codesCopied'));
  }
}
