import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  ManagedSetupAccount,
  SetupAccessRequest,
  SetupInvitation,
} from '../../../core/models/setup.model';
import { AdminApiService } from '../../../core/services/admin-api.service';

@Component({
  selector: 'app-admin-accesses',
  imports: [TranslatePipe],
  templateUrl: './admin-accesses.html',
})
export class AdminAccesses implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly errorMessage = signal('');
  readonly users = signal<ManagedSetupAccount[]>([]);
  readonly requests = signal<SetupAccessRequest[]>([]);
  readonly invitation = signal<SetupInvitation | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getAccessManagement()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ users, requests }) => {
          this.users.set(users);
          this.requests.set(requests);
        },
        error: (error) => this.errorMessage.set(accessError(error)),
      });
  }

  approve(request: SetupAccessRequest): void {
    this.run(request.id, () =>
      this.api.approveProductAccessRequest(request.id).subscribe({
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
      this.api.rejectProductAccessRequest(request.id).subscribe({
        next: () => {
          this.busyId.set('');
          this.load();
        },
        error: (error) => this.fail(error),
      }),
    );
  }

  toggleSkins(user: ManagedSetupAccount): void {
    this.update(user, { canAccessSkins: !user.canAccessSkins });
  }

  toggleSetups(user: ManagedSetupAccount): void {
    this.update(user, {
      canAccessSetups: !user.canAccessSetups,
      canUploadSetups: user.canAccessSetups ? false : user.canUploadSetups,
    });
  }

  toggleSetupUpload(user: ManagedSetupAccount): void {
    this.update(user, {
      canAccessSetups: true,
      canUploadSetups: !user.canUploadSetups,
    });
  }

  setActive(user: ManagedSetupAccount, active: boolean): void {
    if (
      !active &&
      !window.confirm(
        this.i18n.translate('admin.accesses.confirmRevoke', { name: user.displayName }),
      )
    ) {
      return;
    }
    this.run(user.id, () =>
      this.api.setProductAccountActive(user.id, active).subscribe({
        next: ({ user: updated }) => this.replaceUser(updated),
        error: (error) => this.fail(error),
      }),
    );
  }

  invitationUrl(): string {
    const path = this.invitation()?.path;
    return path ? `${window.location.origin}${path}` : '';
  }

  async copyInvitation(): Promise<void> {
    await navigator.clipboard.writeText(this.invitationUrl());
  }

  private update(
    user: ManagedSetupAccount,
    changes: Partial<
      Pick<ManagedSetupAccount, 'canAccessSkins' | 'canAccessSetups' | 'canUploadSetups'>
    >,
  ): void {
    const permissions = {
      canAccessSkins: changes.canAccessSkins ?? user.canAccessSkins,
      canAccessSetups: changes.canAccessSetups ?? user.canAccessSetups,
      canUploadSetups: changes.canUploadSetups ?? user.canUploadSetups,
    };
    this.run(user.id, () =>
      this.api.updateProductPermissions(user.id, permissions).subscribe({
        next: ({ user: updated }) => this.replaceUser(updated),
        error: (error) => this.fail(error),
      }),
    );
  }

  private replaceUser(updated: ManagedSetupAccount): void {
    this.users.update((users) =>
      users.map((current) => (current.id === updated.id ? updated : current)),
    );
    this.busyId.set('');
  }

  private run(id: string, callback: () => void): void {
    this.errorMessage.set('');
    this.busyId.set(id);
    callback();
  }

  private fail(error: unknown): void {
    this.busyId.set('');
    this.errorMessage.set(accessError(error));
  }
}

function accessError(error: unknown): string {
  return (
    (error as { error?: { error?: { message?: string } } })?.error?.error?.message ||
    'No se pudo completar la operación.'
  );
}
