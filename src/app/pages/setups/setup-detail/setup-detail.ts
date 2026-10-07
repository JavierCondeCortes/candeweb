import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RacingSetup, SetupFile } from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import {
  SetupDirectoryHandle,
  SetupInstallDirectoryService,
} from '../../../core/services/setup-install-directory.service';

@Component({
  selector: 'app-setup-detail',
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './setup-detail.html',
})
export class SetupDetail implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);
  private readonly installDirectory = inject(SetupInstallDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly setup = signal<RacingSetup | null>(null);
  readonly installBusy = signal(false);
  readonly installMessage = signal('');
  readonly installError = signal('');
  readonly installProgress = signal<{ completed: number; total: number } | null>(null);
  readonly rememberDirectory = signal(true);
  readonly savedDirectory = signal<SetupDirectoryHandle | null>(null);
  readonly folderInstallSupported = this.installDirectory.isSupported();

  ngOnInit(): void {
    this.load();
    void this.loadSavedDirectory();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getSetup(this.route.snapshot.paramMap.get('id') ?? '')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ setup }) => {
          this.setup.set(setup);
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

  packageDownloadUrl(setup: RacingSetup): string {
    return this.api.packageDownloadUrl(setup.id);
  }

  async installInFolder(setup: RacingSetup, chooseNew = false): Promise<void> {
    if (this.installBusy()) return;
    this.installBusy.set(true);
    this.installMessage.set('');
    this.installError.set('');
    this.installProgress.set(null);

    try {
      let directory = chooseNew ? null : this.savedDirectory();
      directory ??= await this.installDirectory.chooseDirectory();
      if (!(await this.installDirectory.ensureWritePermission(directory))) {
        throw new Error('DIRECTORY_PERMISSION_DENIED');
      }

      const accountId = this.api.session()?.account?.id ?? '';
      if (this.rememberDirectory()) {
        await this.installDirectory.saveDirectory(accountId, directory);
        this.savedDirectory.set(directory);
      } else {
        await this.installDirectory.forgetDirectory(accountId);
        this.savedDirectory.set(null);
      }

      const files = availableFiles(setup.files ?? []);
      if (!files.length) throw new Error('SETUP_FILES_MISSING');
      const usedNames = new Set<string>();
      this.installProgress.set({ completed: 0, total: files.length });
      for (const [index, file] of files.entries()) {
        const contents = await firstValueFrom(this.api.downloadFileBlob(setup.id, file.id));
        await this.installDirectory.writeFile(
          directory,
          uniqueLocalFileName(file, usedNames),
          contents,
        );
        this.installProgress.set({ completed: index + 1, total: files.length });
      }
      this.installMessage.set(
        this.i18n.translate('home.setups.detail.installSuccess', {
          count: files.length,
          folder: directory.name,
        }),
      );
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        this.installError.set(this.i18n.translate('home.setups.detail.installError'));
      }
    } finally {
      this.installBusy.set(false);
    }
  }

  async forgetSavedDirectory(): Promise<void> {
    await this.installDirectory.forgetDirectory(this.api.session()?.account?.id ?? '');
    this.savedDirectory.set(null);
    this.installMessage.set(this.i18n.translate('home.setups.detail.folderForgotten'));
    this.installError.set('');
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

  private async loadSavedDirectory(): Promise<void> {
    try {
      const accountId = this.api.session()?.account?.id ?? '';
      this.savedDirectory.set(await this.installDirectory.getSavedDirectory(accountId));
    } catch {
      this.savedDirectory.set(null);
    }
  }
}

function availableFiles(files: SetupFile[]): SetupFile[] {
  const now = Date.now();
  return files.filter((file) => !file.expiresAt || Date.parse(file.expiresAt) > now);
}

function uniqueLocalFileName(file: SetupFile, usedNames: Set<string>): string {
  const cleaned = file.originalName
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 180);
  const fallback = `setup-v${file.versionNumber}${file.extension}`;
  const preferred = cleaned || fallback;
  let candidate = preferred;
  let duplicate = 2;
  while (usedNames.has(candidate.toLocaleLowerCase())) {
    const dot = preferred.lastIndexOf('.');
    const stem = dot > 0 ? preferred.slice(0, dot) : preferred;
    const extension = dot > 0 ? preferred.slice(dot) : '';
    candidate = `${stem.slice(0, 150)}-${duplicate}${extension}`;
    duplicate += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase());
  return candidate;
}

function setupError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo completar la operación.'
  );
}
