import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import {
  ChampionshipContent,
  ChampionshipStatus,
  SportsCorrection,
  TournamentSourceSummary,
} from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import {
  apiErrorMessage,
  apiFieldErrors,
  clientFieldErrors,
  focusErrorSummary,
} from '../admin-form-errors';

@Component({
  selector: 'app-admin-championship-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-championship-form.html',
})
export class AdminChampionshipForm implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
    description: ['', [Validators.maxLength(5000)]],
    coverUrl: [''],
    coverAlt: ['', [Validators.maxLength(160)]],
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
        error: (error) => this.errorMessage.set(apiErrorMessage(error)),
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
        error: (error) => this.correctionError.set(apiErrorMessage(error)),
      });
  }

  save(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.errorMessage.set('Revisa los campos señalados antes de guardar.');
      this.fieldErrors.set(
        clientFieldErrors(this.form, {
          name: 'El nombre',
          slug: 'El slug',
          subtitle: 'El subtítulo',
          season: 'La temporada',
          summary: 'El resumen',
          description: 'La descripción',
          coverAlt: 'El texto alternativo',
          displayOrder: 'El orden',
        }),
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
      this.errorMessage.set('Comprueba el torneo externo antes de guardar el Candeonato.');
      this.fieldErrors.set({
        externalTournamentId: 'Pulsa “Comprobar torneo” y revisa el nombre encontrado.',
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
        this.errorMessage.set(apiErrorMessage(error));
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
      this.sourceError.set('Introduce primero un ID de torneo válido.');
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
        error: (error) => this.sourceError.set(apiErrorMessage(error)),
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
      this.coverUploadError.set('Selecciona una imagen JPEG, PNG, WebP o AVIF de hasta 12 MB.');
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
              'Portada subida. Guarda el Candeonato para aplicar el cambio.',
            );
          },
          error: (error) => {
            this.coverUploadError.set(
              error?.name === 'TimeoutError'
                ? 'La subida está tardando demasiado. Optimiza la imagen o inténtalo de nuevo.'
                : apiErrorMessage(error),
            );
          },
        });
    } catch (error) {
      this.uploading.set(false);
      input.value = '';
      this.coverUploadError.set(apiErrorMessage(error));
    }
  }

  async chooseVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 80 * 1024 * 1024) {
      this.errorMessage.set('Selecciona un vídeo MP4 o WebM de hasta 80 MB.');
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
          this.errorMessage.set(apiErrorMessage(error));
          focusErrorSummary('championship-form-error');
        },
      });
    } catch (error) {
      this.videoUploading.set(false);
      this.errorMessage.set(apiErrorMessage(error));
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
        error: (error) => this.correctionError.set(apiErrorMessage(error)),
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
    description: championship.description ?? '',
    coverUrl: championship.coverUrl ?? '',
    coverAlt: championship.coverAlt ?? '',
    backgroundVideoUrl: championship.backgroundVideoUrl ?? '',
    backgroundVideoMimeType: championship.backgroundVideoMimeType ?? '',
    startAt: localDateValue(championship.startAt),
    endAt: localDateValue(championship.endAt),
    registrationUrl: championship.registrationUrl ?? '',
    rulesUrl: championship.rulesUrl ?? '',
    status: championship.status,
    isFeatured: championship.isFeatured,
    displayOrder: championship.displayOrder,
  };
}

function localDateValue(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}
