import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RacingSetup, SetupInput, SetupSessionType } from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';

@Component({
  selector: 'app-setup-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './setup-form.html',
})
export class SetupForm implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly id = this.route.snapshot.paramMap.get('id');
  readonly loading = signal(Boolean(this.id));
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly existing = signal<RacingSetup | null>(null);
  readonly canManage = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    simulator: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    car: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    track: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    configuration: ['', [Validators.maxLength(100)]],
    sessionType: ['race' as SetupSessionType, [Validators.required]],
    description: ['', [Validators.maxLength(1000)]],
    tags: [''],
    notes: ['', [Validators.maxLength(500)]],
    retentionDays: ['90'],
  });

  ngOnInit(): void {
    this.canManage.set(['owner', 'admin'].includes(this.api.session()?.account?.role ?? ''));
    if (!this.id) return;
    this.api
      .getSetup(this.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ setup, capabilities }) => {
          this.existing.set(setup);
          this.canManage.set(capabilities.canManage);
          this.form.patchValue({
            title: setup.title,
            simulator: setup.simulator,
            car: setup.car,
            track: setup.track,
            configuration: setup.configuration ?? '',
            sessionType: setup.sessionType,
            description: setup.description ?? '',
            tags: setup.tags.join(', '),
          });
          this.form.markAsPristine();
        },
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorMessage.set('');
    if (!file) {
      this.selectedFile.set(null);
      return;
    }
    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    const allowed = ['.sto', '.svm', '.set', '.setup', '.ini', '.json', '.xml', '.zip'];
    if (!allowed.includes(extension) || file.size > 25 * 1024 * 1024 || file.size === 0) {
      this.errorMessage.set('El archivo no es válido o supera 25 MB.');
      input.value = '';
      this.selectedFile.set(null);
      return;
    }
    this.selectedFile.set(file);
    this.form.markAsDirty();
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    const value = this.form.getRawValue();
    const input: SetupInput = {
      title: value.title,
      simulator: value.simulator,
      car: value.car,
      track: value.track,
      configuration: value.configuration,
      sessionType: value.sessionType,
      description: value.description,
      tags: value.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      updatedAt: this.existing()?.updatedAt,
    };
    const saveRequest = this.id
      ? this.api.updateSetup(this.id, input)
      : this.api.createSetup(input);
    saveRequest
      .pipe(
        switchMap(({ setup }) => {
          const file = this.selectedFile();
          if (!file) return of({ setup });
          const parsedRetention = Number(value.retentionDays);
          return this.api.uploadFile(setup.id, file, {
            notes: value.notes,
            retentionDays:
              this.canManage() && Number.isInteger(parsedRetention) && parsedRetention > 0
                ? parsedRetention
                : null,
          });
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: ({ setup }) => {
          this.form.markAsPristine();
          void this.router.navigate(['/setups', setup.id]);
        },
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  hasPendingChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}

function setupError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo guardar el setup.'
  );
}
