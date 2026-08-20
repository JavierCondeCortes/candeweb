import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TeamMemberContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-members',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './admin-members.html',
})
export class AdminMembers implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly i18n = inject(I18nService);
  readonly members = signal<TeamMemberContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly query = signal('');
  readonly statusFilter = signal<'all' | TeamMemberContent['status']>('all');
  readonly isFiltered = computed(
    () => Boolean(this.query().trim()) || this.statusFilter() !== 'all',
  );
  readonly filteredMembers = computed(() => {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    const status = this.statusFilter();
    return this.members().filter(
      (member) =>
        (status === 'all' || member.status === status) &&
        (!query ||
          [member.name, member.alias, member.roleLabel]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase(this.i18n.language()).includes(query))),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  move(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    const current = [...this.members()];
    if (nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    this.members.set(current);
    this.message.set(this.i18n.translate('admin.members.savingOrder'));
    this.api.reorderMembers(current.map((member) => member.id)).subscribe({
      next: () => this.message.set(this.i18n.translate('admin.members.orderSaved')),
      error: (error) => {
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        );
        this.load();
      },
    });
  }

  runAction(member: TeamMemberContent, action: 'publish' | 'archive'): void {
    if (
      action === 'archive' &&
      !window.confirm(this.i18n.translate('admin.members.confirmArchive', { name: member.name }))
    )
      return;
    this.busyId.set(member.id);
    this.errorMessage.set('');
    this.api
      .memberAction(member.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: ({ member: updated }) => {
          this.members.update((members) =>
            members.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.message.set(
            this.i18n.translate(
              action === 'publish'
                ? 'admin.members.publishedMessage'
                : 'admin.members.archivedMessage',
            ),
          );
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  deleteMember(member: TeamMemberContent): void {
    if (!window.confirm(this.i18n.translate('admin.members.confirmDelete', { name: member.name })))
      return;
    this.busyId.set(member.id);
    this.errorMessage.set('');
    this.api
      .deleteMember(member.id)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.members.update((members) => members.filter((item) => item.id !== member.id));
          this.message.set(this.i18n.translate('admin.members.deletedMessage'));
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getMembers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ members }) => this.members.set(members),
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  statusLabel(status: TeamMemberContent['status']): string {
    return this.i18n.translate(`admin.common.${status}`);
  }

  socialLabels(member: TeamMemberContent): string {
    const labels = [
      member.twitchUrl && 'Twitch',
      member.instagramUrl && 'Instagram',
      member.youtubeUrl && 'YouTube',
      member.xUrl && 'X',
      member.discordUrl && 'Discord',
      member.websiteUrl && this.i18n.translate('admin.memberForm.website'),
    ].filter(Boolean);
    return labels.join(' · ') || this.i18n.translate('admin.members.noSocials');
  }
}
