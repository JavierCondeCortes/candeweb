import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MemberStatus } from '../../../core/models/content-admin.model';
import { SkinContent } from '../../../core/models/skin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage, apiFieldErrors, focusErrorSummary } from '../admin-form-errors';

@Component({
  selector: 'app-admin-skin-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-skin-form.html',
})
export class AdminSkinForm implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly skinId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');
  readonly uploadMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly loadedUpdatedAt = signal('');
  readonly updatedByName = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    carName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    imageUrl: ['', Validators.required],
    imageAlt: ['', [Validators.required, Validators.maxLength(160)]],
    targetUrl: ['', Validators.required],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    status: this.formBuilder.nonNullable.control<MemberStatus>('draft'),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.skinId.set(id);
    this.loading.set(true);
    this.api.getSkin(id).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ skin }) => {
        this.loadedUpdatedAt.set(skin.updatedAt);
        this.updatedByName.set(skin.updatedByName ?? null);
        this.form.reset(toSkinForm(skin));
        this.form.markAsPristine();
      },
      error: (error) => this.showError(error),
    });
  }

  save(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set('');
    this.fieldErrors.set({});
    if (this.form.invalid || this.saving()) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      focusErrorSummary('skin-form-error');
      return;
    }
    this.saving.set(true);
    const id = this.skinId();
    const input = this.form.getRawValue();
    const request = id
      ? this.api.updateSkin(id, { ...input, updatedAt: this.loadedUpdatedAt() })
      : this.api.createSkin(input);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ skin }) => {
        this.loadedUpdatedAt.set(skin.updatedAt);
        this.saved.set(true);
        this.form.markAsPristine();
        void this.router.navigate(['/admin/skins', skin.id]);
      },
      error: (error) => {
        this.showError(error);
        this.fieldErrors.set(apiFieldErrors(error));
        focusErrorSummary('skin-form-error');
      },
    });
  }

  async chooseImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errorMessage.set('');
    this.uploadMessage.set('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      this.errorMessage.set(this.i18n.translate('admin.skinForm.invalidImage'));
      input.value = '';
      return;
    }
    this.uploading.set(true);
    try {
      const request = await this.api.uploadImage(file, 'skin', this.form.controls.imageAlt.value);
      request.pipe(finalize(() => { this.uploading.set(false); input.value = ''; })).subscribe({
        next: ({ asset }) => {
          this.form.controls.imageUrl.setValue(asset.publicUrl);
          this.form.controls.imageUrl.markAsDirty();
          this.uploadMessage.set(this.i18n.translate('admin.skinForm.uploadSuccess'));
        },
        error: (error) => this.showError(error),
      });
    } catch (error) {
      this.uploading.set(false);
      input.value = '';
      this.showError(error);
    }
  }

  hasPendingChanges(): boolean { return this.form.dirty && !this.saved(); }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private showError(error: unknown): void {
    this.errorMessage.set(apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) => this.i18n.translate(key)));
  }
}

function toSkinForm(skin: SkinContent) {
  return {
    carName: skin.carName,
    imageUrl: skin.imageUrl,
    imageAlt: skin.imageAlt,
    targetUrl: skin.targetUrl,
    displayOrder: skin.displayOrder,
    status: skin.status,
  };
}
