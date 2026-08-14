import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  AdminAccessRequest,
  AdminAccessRequestStatus,
  AdminAccount,
  AdminInvitation,
} from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-users.html',
})
export class AdminUsers implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly i18n = inject(I18nService);

  readonly session = this.api.session;
  readonly loading = signal(true);
  readonly actionId = signal('');
  readonly users = signal<AdminAccount[]>([]);
  readonly requests = signal<AdminAccessRequest[]>([]);
  readonly invitation = signal<AdminInvitation | null>(null);
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly invitationUrl = computed(() => {
    const path = this.invitation()?.path;
    return path ? new URL(path, window.location.origin).href : '';
  });
  readonly invitationMailto = computed(() => {
    const invitation = this.invitation();
    if (!invitation) return '';
    const subject = this.i18n.translate('admin.users.mailSubject');
    const body = this.i18n.translate('admin.users.mailBody', { url: this.invitationUrl() });
    return `mailto:${encodeURIComponent(invitation.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getAdminUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ users, requests }) => {
          this.users.set(users);
          this.requests.set(requests);
        },
        error: (error) => this.showError(error),
      });
  }

  approve(request: AdminAccessRequest): void {
    this.run(request.id, this.api.approveAccessRequest(request.id), ({ invitation }) => {
      this.invitation.set(invitation);
      this.message.set(this.i18n.translate('admin.users.approvedMessage'));
      this.load();
    });
  }

  reject(request: AdminAccessRequest): void {
    if (
      !window.confirm(
        this.i18n.translate('admin.users.confirmReject', { name: request.displayName }),
      )
    )
      return;
    this.run(request.id, this.api.rejectAccessRequest(request.id), () => {
      this.message.set(this.i18n.translate('admin.users.rejectedMessage'));
      this.load();
    });
  }

  toggle(user: AdminAccount): void {
    const active = !user.active;
    if (
      !window.confirm(
        this.i18n.translate(
          active ? 'admin.users.confirmActivate' : 'admin.users.confirmDeactivate',
          { name: user.displayName },
        ),
      )
    )
      return;
    this.run(user.id, this.api.setAdminActive(user.id, active), () => {
      this.message.set(
        this.i18n.translate(
          active ? 'admin.users.activatedMessage' : 'admin.users.deactivatedMessage',
        ),
      );
      this.load();
    });
  }

  revokeSessions(user: AdminAccount): void {
    if (
      !window.confirm(this.i18n.translate('admin.users.confirmRevoke', { name: user.displayName }))
    )
      return;
    this.run(user.id, this.api.revokeAdminSessions(user.id), () => {
      this.message.set(this.i18n.translate('admin.users.revokedMessage'));
    });
  }

  async copyInvitation(): Promise<void> {
    await navigator.clipboard.writeText(this.invitationUrl());
    this.message.set(this.i18n.translate('admin.users.linkCopied'));
  }

  closeInvitation(): void {
    this.invitation.set(null);
  }

  requestStatusKey(status: AdminAccessRequestStatus): string {
    return `admin.users.status.${status}`;
  }

  private run<T>(
    id: string,
    request: import('rxjs').Observable<T>,
    next: (value: T) => void,
  ): void {
    this.actionId.set(id);
    this.errorMessage.set('');
    this.message.set('');
    request
      .pipe(finalize(() => this.actionId.set('')))
      .subscribe({ next, error: (error) => this.showError(error) });
  }

  private showError(error: unknown): void {
    this.errorMessage.set(
      apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
        this.i18n.translate(key),
      ),
    );
  }
}
