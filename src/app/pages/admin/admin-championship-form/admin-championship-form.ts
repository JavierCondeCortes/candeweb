import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { madridDateTimeLocalValue } from '../../../core/date-time/madrid-date-time';
import {
  ChampionshipContent,
  ChampionshipStatus,
  SportsCorrection,
  TournamentSourceSummary,
} from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  apiErrorMessage,
  apiFieldErrors,
  clientFieldErrors,
  focusErrorSummary,
} from '../admin-form-errors';

@Component({
  selector: 'app-admin-championship-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-championship-form.html',
})
export class AdminChampionshipForm implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly championshipId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly coverUploadError = signal('');
  readonly coverUploadSuccess = signal('');
  readonly videoUploading = signal(false);
  readonly errorMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly saved = signal(false);
  readonly loadedUpdatedAt = signal('');
  readonly updatedByName = signal<string | null>(null);
  readonly loadedExternalId = signal<number | null>(null);
  readonly sourceChecking = signal(false);
  readonly sourcePreview = signal<TournamentSourceSummary | null>(null);
  readonly sourceError = signal('');
  readonly corrections = signal<SportsCorrection[]>([]);
  readonly correctionsLoading = signal(false);
  readonly correctionSaving = signal(false);
  readonly correctionError = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    externalTournamentId: this.formBuilder.control<number | null>(null),
    slug: ['', [Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    editionNumber: this.formBuilder.control<number | null>(null),
    subtitle: ['', [Validators.maxLength(100)]],
    season: ['', [Validators.maxLength(30)]],
    summary: ['', [Validators.maxLength(320)]],
    summaryEn: ['', [Validators.maxLength(320)]],
    description: ['', [Validators.maxLength(5000)]],
    descriptionEn: ['', [Validators.maxLength(5000)]],
    coverUrl: [''],
    coverAlt: ['', [Validators.maxLength(160)]],
    coverAltEn: ['', [Validators.maxLength(160)]],
    backgroundVideoUrl: [''],
    backgroundVideoMimeType: [''],
    startAt: [''],
    endAt: [''],
    registrationUrl: [''],
    rulesUrl: [''],
    status: this.formBuilder.nonNullable.control<ChampionshipStatus>('draft'),
    isFeatured: [false],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
  });
  readonly correctionForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    note: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1200)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.championshipId.set(id);
    this.loadCorrections(id);
    this.loading.set(true);
    this.api
      .getChampionship(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ championship }) => {
          this.loadedUpdatedAt.set(championship.updatedAt);
          this.updatedByName.set(championship.updatedByName ?? null);
          this.loadedExternalId.set(championship.externalTournamentId);
          this.form.reset(toChampionshipForm(championship));
          this.form.markAsPristine();
          if (championship.externalTournamentId) this.checkSource();
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  createCorrection(): void {
    const id = this.championshipId();
    this.correctionForm.markAllAsTouched();
    this.correctionError.set('');
    if (!id || this.correctionForm.invalid || this.correctionSaving()) return;
    this.correctionSaving.set(true);
    this.api
      .createChampionshipCorrection(id, this.correctionForm.getRawValue())
      .pipe(finalize(() => this.correctionSaving.set(false)))
      .subscribe({
        next: ({ correction }) => {
          this.corrections.update((corrections) => [correction, ...corrections]);
          this.correctionForm.reset({ reason: '', note: '' });
          this.correctionForm.markAsPristine();
        },
        error: (error) =>
          this.correctionError.set(
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
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      this.fieldErrors.set(
        clientFieldErrors(
          this.form,
          {
            name: this.i18n.translate('admin.championshipForm.name').replace(' *', ''),
            slug: this.i18n.translate('admin.championshipForm.slug'),
            subtitle: this.i18n.translate('admin.championshipForm.subtitle'),
            season: this.i18n.translate('admin.championshipForm.season'),
            summary: this.i18n.translate('admin.championshipForm.summary'),
            summaryEn: this.i18n.translate('admin.championshipForm.summaryEn'),
            description: this.i18n.translate('admin.championshipForm.description'),
            descriptionEn: this.i18n.translate('admin.championshipForm.descriptionEn'),
            coverAlt: this.i18n.translate('admin.championshipForm.coverAlt'),
            coverAltEn: this.i18n.translate('admin.championshipForm.coverAltEn'),
            displayOrder: this.i18n.translate('admin.common.order'),
          },
          (key, params) => this.i18n.translate(key, params),
        ),
      );
      focusErrorSummary('championship-form-error');
      return;
    }
    if (this.saving()) return;

    const externalTournamentId = this.form.controls.externalTournamentId.value;
    if (
      externalTournamentId &&
      externalTournamentId !== this.loadedExternalId() &&
      this.sourcePreview()?.id !== externalTournamentId
    ) {
      this.errorMessage.set(this.i18n.translate('admin.championshipForm.invalidSource'));
      this.fieldErrors.set({
        externalTournamentId: this.i18n.translate('admin.championshipForm.sourceCheckRequired'),
      });
      focusErrorSummary('championship-form-error');
      return;
    }

    this.saving.set(true);
    const input = this.form.getRawValue();
    const id = this.championshipId();
    const request = id
      ? this.api.updateChampionship(id, { ...input, updatedAt: this.loadedUpdatedAt() })
      : this.api.createChampionship(input);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ championship }) => {
        this.loadedUpdatedAt.set(championship.updatedAt);
        this.updatedByName.set(championship.updatedByName ?? null);
        this.saved.set(true);
        this.form.markAsPristine();
        void this.router.navigate(['/admin/candeonatos', championship.id]);
      },
      error: (error) => {
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        );
        this.fieldErrors.set(apiFieldErrors(error));
        focusErrorSummary('championship-form-error');
      },
    });
  }

  checkSource(): void {
    const externalTournamentId = this.form.controls.externalTournamentId.value;
    this.sourcePreview.set(null);
    this.sourceError.set('');
    if (!externalTournamentId || !Number.isInteger(externalTournamentId)) {
      this.sourceError.set(this.i18n.translate('admin.championshipForm.invalidSourceId'));
      return;
    }
    this.sourceChecking.set(true);
    this.api
      .validateTournamentSource(externalTournamentId)
      .pipe(finalize(() => this.sourceChecking.set(false)))
      .subscribe({
        next: ({ tournament }) => {
          this.sourcePreview.set(tournament);
          this.fieldErrors.update((errors) => {
            const next = { ...errors };
            delete next['externalTournamentId'];
            return next;
          });
        },
        error: (error) =>
          this.sourceError.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  async chooseImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.coverUploadError.set('');
    this.coverUploadSuccess.set('');
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      this.coverUploadError.set(this.i18n.translate('admin.championshipForm.invalidImage'));
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.errorMessage.set('');
    try {
      const request = await this.api.uploadImage(
        file,
        'championship',
        this.form.controls.coverAlt.value,
      );
      request
        .pipe(
          timeout(120_000),
          finalize(() => {
            this.uploading.set(false);
            input.value = '';
          }),
        )
        .subscribe({
          next: ({ asset }) => {
            this.form.controls.coverUrl.setValue(asset.publicUrl);
            this.form.controls.coverUrl.markAsDirty();
            this.coverUploadSuccess.set(
              this.i18n.translate('admin.championshipForm.coverUploaded'),
            );
          },
          error: (error) => {
            this.coverUploadError.set(
              error?.name === 'TimeoutError'
                ? this.i18n.translate('admin.championshipForm.uploadTimeout')
                : apiErrorMessage(
                    error,
                    this.i18n.translate('admin.common.operationFailed'),
                    (key) => this.i18n.translate(key),
                  ),
            );
          },
        });
    } catch (error) {
      this.uploading.set(false);
      input.value = '';
      this.coverUploadError.set(
        apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
          this.i18n.translate(key),
        ),
      );
    }
  }

  async chooseVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 80 * 1024 * 1024) {
      this.errorMessage.set(this.i18n.translate('admin.championshipForm.invalidVideo'));
      focusErrorSummary('championship-form-error');
      return;
    }
    this.videoUploading.set(true);
    this.errorMessage.set('');
    try {
      const request = await this.api.uploadVideo(file);
      request.pipe(finalize(() => this.videoUploading.set(false))).subscribe({
        next: ({ asset }) => {
          this.form.controls.backgroundVideoUrl.setValue(asset.publicUrl);
          this.form.controls.backgroundVideoMimeType.setValue(asset.mimeType);
        },
        error: (error) => {
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          );
          focusErrorSummary('championship-form-error');
        },
      });
    } catch (error) {
      this.videoUploading.set(false);
      this.errorMessage.set(
        apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
          this.i18n.translate(key),
        ),
      );
      focusErrorSummary('championship-form-error');
    }
  }

  hasPendingChanges(): boolean {
    return (this.form.dirty && !this.saved()) || this.correctionForm.dirty;
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  private loadCorrections(id: string): void {
    this.correctionsLoading.set(true);
    this.api
      .getChampionshipCorrections(id)
      .pipe(finalize(() => this.correctionsLoading.set(false)))
      .subscribe({
        next: ({ corrections }) => this.corrections.set(corrections),
        error: (error) =>
          this.correctionError.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }
}

function toChampionshipForm(championship: ChampionshipContent) {
  return {
    externalTournamentId: championship.externalTournamentId,
    slug: championship.slug,
    name: championship.name,
    editionNumber: championship.editionNumber,
    subtitle: championship.subtitle ?? '',
    season: championship.season ?? '',
    summary: championship.summary ?? '',
    summaryEn: championship.summaryEn ?? '',
    description: championship.description ?? '',
    descriptionEn: championship.descriptionEn ?? '',
    coverUrl: championship.coverUrl ?? '',
    coverAlt: championship.coverAlt ?? '',
    coverAltEn: championship.coverAltEn ?? '',
    backgroundVideoUrl: championship.backgroundVideoUrl ?? '',
    backgroundVideoMimeType: championship.backgroundVideoMimeType ?? '',
    startAt: madridDateTimeLocalValue(championship.startAt),
    endAt: madridDateTimeLocalValue(championship.endAt),
    registrationUrl: championship.registrationUrl ?? '',
    rulesUrl: championship.rulesUrl ?? '',
    status: championship.status,
    isFeatured: championship.isFeatured,
    displayOrder: championship.displayOrder,
  };
}
