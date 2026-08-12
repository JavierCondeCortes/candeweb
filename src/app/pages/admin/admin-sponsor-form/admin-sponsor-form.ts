import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { MemberStatus, SponsorContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorMessage, apiFieldErrors, focusErrorSummary } from '../admin-form-errors';

@Component({
  selector: 'app-admin-sponsor-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-sponsor-form.html',
})
export class AdminSponsorForm implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly sponsorId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly loadedUpdatedAt = signal('');
  readonly updatedByName = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(240)],
    logoUrl: [''],
    logoAlt: ['', Validators.maxLength(160)],
    websiteUrl: [''],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    status: this.formBuilder.nonNullable.control<MemberStatus>('draft'),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.sponsorId.set(id);
    this.loading.set(true);
    this.api
      .getSponsor(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ sponsor }) => {
          this.loadedUpdatedAt.set(sponsor.updatedAt);
          this.updatedByName.set(sponsor.updatedByName ?? null);
          this.form.reset(toSponsorForm(sponsor));
          this.form.markAsPristine();
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  save(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set('');
    this.fieldErrors.set({});
    if (this.form.invalid || this.saving()) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      focusErrorSummary('sponsor-form-error');
      return;
    }
    this.saving.set(true);
    const id = this.sponsorId();
    const input = this.form.getRawValue();
    const request = id
      ? this.api.updateSponsor(id, { ...input, updatedAt: this.loadedUpdatedAt() })
      : this.api.createSponsor(input);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ sponsor }) => {
        this.loadedUpdatedAt.set(sponsor.updatedAt);
        this.saved.set(true);
        this.form.markAsPristine();
        void this.router.navigate(['/admin/sponsors', sponsor.id]);
      },
      error: (error) => {
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        );
        this.fieldErrors.set(apiFieldErrors(error));
        focusErrorSummary('sponsor-form-error');
      },
    });
  }

  async chooseImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      this.errorMessage.set(this.i18n.translate('admin.sponsorForm.invalidImage'));
      return;
    }
    this.uploading.set(true);
    try {
      const request = await this.api.uploadImage(file, 'sponsor', this.form.controls.logoAlt.value);
      request.pipe(finalize(() => this.uploading.set(false))).subscribe({
        next: ({ asset }) => this.form.controls.logoUrl.setValue(asset.publicUrl),
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
    } catch (error) {
      this.uploading.set(false);
      this.errorMessage.set(
        apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
          this.i18n.translate(key),
        ),
      );
    }
  }

  hasPendingChanges(): boolean {
    return this.form.dirty && !this.saved();
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }
}

function toSponsorForm(sponsor: SponsorContent) {
  return {
    name: sponsor.name,
    description: sponsor.description ?? '',
    logoUrl: sponsor.logoUrl ?? '',
    logoAlt: sponsor.logoAlt ?? '',
    websiteUrl: sponsor.websiteUrl ?? '',
    displayOrder: sponsor.displayOrder,
    status: sponsor.status,
  };
}
