import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  ManagedSetupAccount,
  SetupAccessRequest,
  SetupInvitation,
} from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-setup-users',
  imports: [TranslatePipe],
  templateUrl: './setup-users.html',
})
export class SetupUsers implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly errorMessage = signal('');
  readonly users = signal<ManagedSetupAccount[]>([]);
  readonly requests = signal<SetupAccessRequest[]>([]);
  readonly invitation = signal<SetupInvitation | null>(null);
  readonly storage = signal({ usedBytes: 0, expiringFiles: 0 });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getAccessManagement()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ users, requests, storage }) => {
          this.users.set(users);
          this.requests.set(requests);
          this.storage.set(storage);
        },
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  approve(request: SetupAccessRequest): void {
    this.run(request.id, () =>
      this.api.approveRequest(request.id).subscribe({
        next: ({ invitation }) => {
          this.invitation.set(invitation);
          this.busyId.set('');
          this.load();
        },
        error: (error) => this.fail(error),
      }),
    );
  }

  reject(request: SetupAccessRequest): void {
    this.run(request.id, () =>
      this.api.rejectRequest(request.id).subscribe({
        next: () => {
          this.busyId.set('');
          this.load();
        },
        error: (error) => this.fail(error),
      }),
    );
  }

  toggleUpload(user: ManagedSetupAccount): void {
    this.update(user, true, !user.canUploadSetups);
  }

  async revoke(user: ManagedSetupAccount): Promise<void> {
    if (
      !(await this.confirmation.confirm({
        message: this.i18n.translate('home.setups.common.confirmRevoke', {
          name: user.displayName,
        }),
        tone: 'danger',
      }))
    )
      return;
    this.update(user, false, false);
  }

  restore(user: ManagedSetupAccount): void {
    this.update(user, true, false);
  }

  invitationUrl(): string {
    const path = this.invitation()?.path;
    return path ? `${window.location.origin}${path}` : '';
  }

  async copyInvitation(): Promise<void> {
    await navigator.clipboard.writeText(this.invitationUrl());
  }

  formatBytes(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private update(user: ManagedSetupAccount, access: boolean, upload: boolean): void {
    this.run(user.id, () =>
      this.api.updatePermissions(user.id, access, upload).subscribe({
        next: ({ user: updated }) => {
          this.users.update((users) =>
            users.map((current) => (current.id === updated.id ? updated : current)),
          );
          this.busyId.set('');
        },
        error: (error) => this.fail(error),
      }),
    );
  }

  private run(id: string, callback: () => void): void {
    this.errorMessage.set('');
    this.busyId.set(id);
    callback();
  }

  private fail(error: unknown): void {
    this.busyId.set('');
    this.errorMessage.set(setupError(error));
  }
}

function setupError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo completar la operación.'
  );
}
