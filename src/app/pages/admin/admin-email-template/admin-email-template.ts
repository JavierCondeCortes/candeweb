import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AccessInvitationEmailTemplate } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { apiErrorMessage, apiFieldErrors, focusErrorSummary } from '../admin-form-errors';

@Component({
  selector: 'app-admin-email-template',
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  templateUrl: './admin-email-template.html',
  styleUrl: './admin-email-template.css',
})
export class AdminEmailTemplate implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly busyAction = signal('');
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly previewSubject = signal('');
  readonly previewHtml = signal('');
  readonly previewText = signal('');
  readonly smtpConfigured = signal(false);
  readonly smtpIssue = signal<string | null>(null);
  readonly isCustom = signal(false);
  readonly updatedAt = signal<string | null>(null);
  readonly updatedByName = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    subjectTemplate: ['', [Validators.required, Validators.maxLength(180)]],
    htmlTemplate: ['', [Validators.required, Validators.maxLength(60_000)]],
    css: ['', [Validators.required, Validators.maxLength(30_000)]],
    textTemplate: ['', [Validators.required, Validators.maxLength(20_000)]],
  });

  ngOnInit(): void {
    this.api
      .getAccessInvitationEmailTemplate()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (configuration) => {
          this.applyConfiguration(configuration);
          this.preview();
        },
        error: (error) => this.showError(error),
      });
  }

  hasPendingChanges(): boolean {
    return this.form.dirty;
  }

  preview(): void {
    if (!this.prepareSubmission()) return;
    this.busyAction.set('preview');
    this.api
      .previewAccessInvitationEmail(this.templateInput())
      .pipe(finalize(() => this.busyAction.set('')))
      .subscribe({
        next: ({ preview }) => {
          this.previewSubject.set(preview.subject);
          this.previewHtml.set(preview.html);
          this.previewText.set(preview.text);
        },
        error: (error) => this.showError(error),
      });
  }

  save(): void {
    if (!this.prepareSubmission()) return;
    this.busyAction.set('save');
    this.api
      .updateAccessInvitationEmailTemplate(this.templateInput())
      .pipe(finalize(() => this.busyAction.set('')))
      .subscribe({
        next: (configuration) => {
          this.applyConfiguration(configuration);
          this.message.set(this.i18n.translate('admin.email.saved'));
          this.preview();
        },
        error: (error) => this.showError(error),
      });
  }

  sendTest(): void {
    if (!this.prepareSubmission()) return;
    this.busyAction.set('test');
    this.api
      .sendAccessInvitationEmailTest(this.templateInput())
      .pipe(finalize(() => this.busyAction.set('')))
      .subscribe({
        next: ({ delivery }) => {
          this.message.set(this.i18n.translate(`admin.email.testStatus.${delivery.status}`));
        },
        error: (error) => this.showError(error),
      });
  }

  async reset(): Promise<void> {
    if (
      !(await this.confirmation.confirm({
        message: this.i18n.translate('admin.email.confirmReset'),
        confirmLabel: this.i18n.translate('admin.email.reset'),
        tone: 'warning',
      }))
    ) {
      return;
    }
    this.busyAction.set('reset');
    this.clearMessages();
    this.api
      .resetAccessInvitationEmailTemplate()
      .pipe(finalize(() => this.busyAction.set('')))
      .subscribe({
        next: (configuration) => {
          this.applyConfiguration(configuration);
          this.message.set(this.i18n.translate('admin.email.resetDone'));
          this.preview();
        },
        error: (error) => this.showError(error),
      });
  }

  private prepareSubmission(): boolean {
    this.form.markAllAsTouched();
    this.clearMessages();
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      focusErrorSummary('email-template-error');
      return false;
    }
    return true;
  }

  private templateInput(): AccessInvitationEmailTemplate {
    return {
      templateKey: 'access-invitation',
      ...this.form.getRawValue(),
      isCustom: this.isCustom(),
      updatedAt: this.updatedAt(),
      updatedByName: this.updatedByName(),
    };
  }

  private applyConfiguration(configuration: {
    template: AccessInvitationEmailTemplate;
    smtpConfigured: boolean;
    smtpIssue: string | null;
  }): void {
    const { template } = configuration;
    this.form.reset({
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      css: template.css,
      textTemplate: template.textTemplate,
    });
    this.form.markAsPristine();
    this.isCustom.set(template.isCustom);
    this.updatedAt.set(template.updatedAt);
    this.updatedByName.set(template.updatedByName);
    this.smtpConfigured.set(configuration.smtpConfigured);
    this.smtpIssue.set(configuration.smtpIssue);
  }

  private clearMessages(): void {
    this.message.set('');
    this.errorMessage.set('');
    this.fieldErrors.set({});
  }

  private showError(error: unknown): void {
    this.errorMessage.set(
      apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
        this.i18n.translate(key),
      ),
    );
    this.fieldErrors.set(apiFieldErrors(error));
    focusErrorSummary('email-template-error');
  }
}
