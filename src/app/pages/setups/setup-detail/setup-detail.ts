import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RacingSetup, SetupCapabilities, SetupFile } from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-setup-detail',
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './setup-detail.html',
})
export class SetupDetail implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly setup = signal<RacingSetup | null>(null);
  readonly capabilities = signal<SetupCapabilities>({
    canAccess: true,
    canUpload: false,
    canManage: false,
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getSetup(this.route.snapshot.paramMap.get('id') ?? '')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ setup, capabilities }) => {
          this.setup.set(setup);
          this.capabilities.set(capabilities);
        },
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  action(action: 'publish' | 'archive'): void {
    const setup = this.setup();
    if (!setup || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.api
      .setupAction(setup.id, action)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ setup }) => this.setup.set({ ...setup, files: this.setup()?.files }),
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  async deleteSetup(): Promise<void> {
    const setup = this.setup();
    if (
      !setup ||
      !(await this.confirmation.confirm({
        message: this.i18n.translate('home.setups.common.confirmDeleteSetup'),
        tone: 'danger',
      }))
    )
      return;
    this.api.deleteSetup(setup.id).subscribe({
      next: () => void this.router.navigate(['/setups']),
      error: (error) => this.errorMessage.set(setupError(error)),
    });
  }

  updateRetention(file: SetupFile, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const days = value ? Number(value) : null;
    const setup = this.setup();
    if (!setup) return;
    this.api.updateRetention(setup.id, file.id, days).subscribe({
      next: ({ file: updated }) => this.replaceFile(updated),
      error: (error) => this.errorMessage.set(setupError(error)),
    });
  }

  async deleteFile(file: SetupFile): Promise<void> {
    const setup = this.setup();
    if (
      !setup ||
      !(await this.confirmation.confirm({
        message: this.i18n.translate('home.setups.common.confirmDeleteFile', {
          name: file.originalName,
        }),
        tone: 'danger',
      }))
    )
      return;
    this.api.deleteFile(setup.id, file.id).subscribe({
      next: () => this.load(),
      error: (error) => this.errorMessage.set(setupError(error)),
    });
  }

  downloadUrl(file: SetupFile): string {
    return this.api.downloadUrl(file.setupId, file.id);
  }

  periodLabel(setup: RacingSetup): string {
    if (
      typeof setup.season === 'number' &&
      typeof setup.week === 'number' &&
      typeof setup.year === 'number'
    ) {
      return `S${setup.season} · W${setup.week} · ${setup.year}`;
    }
    return this.i18n.translate('home.setups.catalog.periodPending');
  }

  sessionTypeLabel(file: SetupFile): string {
    return this.i18n.translate(`home.setups.sessionType.${file.sessionType || 'other'}`);
  }

  formatBytes(bytes: number): string {
    return bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private replaceFile(updated: SetupFile): void {
    const setup = this.setup();
    if (!setup) return;
    this.setup.set({
      ...setup,
      files: setup.files?.map((file) => (file.id === updated.id ? { ...file, ...updated } : file)),
    });
  }
}

function setupError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo completar la operación.'
  );
}
