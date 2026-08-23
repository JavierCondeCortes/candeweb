import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ChampionshipContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-championships',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './admin-championships.html',
})
export class AdminChampionships implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly i18n = inject(I18nService);
  readonly championships = signal<ChampionshipContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly query = signal('');
  readonly statusFilter = signal<'all' | ChampionshipContent['status']>('all');
  readonly filteredChampionships = computed(() => {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    const status = this.statusFilter();
    return this.championships().filter(
      (championship) =>
        (status === 'all' || championship.status === status) &&
        (!query ||
          [championship.name, championship.season, championship.subtitle]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase(this.i18n.language()).includes(query))),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  runAction(
    championship: ChampionshipContent,
    action: 'publish' | 'archive' | 'feature' | 'sync',
  ): void {
    if (
      action === 'archive' &&
      !window.confirm(
        this.i18n.translate('admin.championships.confirmArchive', { name: championship.name }),
      )
    )
      return;
    this.busyId.set(championship.id);
    this.message.set(
      this.i18n.translate(
        action === 'sync' ? 'admin.championships.syncing' : 'admin.championships.savingChange',
      ),
    );
    this.errorMessage.set('');
    this.api
      .championshipAction(championship.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.message.set(
            action === 'sync'
              ? this.i18n.translate('admin.championships.synced')
              : action === 'feature'
                ? this.i18n.translate('admin.championships.featuredUpdated')
                : this.i18n.translate('admin.championships.statusUpdated'),
          );
          this.load();
        },
        error: (error) => {
          this.message.set('');
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          );
          this.load();
        },
      });
  }

  deleteChampionship(championship: ChampionshipContent): void {
    if (
      !window.confirm(
        this.i18n.translate('admin.championships.confirmDelete', {
          name: championship.name,
        }),
      )
    )
      return;
    this.busyId.set(championship.id);
    this.message.set('');
    this.errorMessage.set('');
    this.api
      .deleteChampionship(championship.id)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.championships.update((items) => items.filter((item) => item.id !== championship.id));
          this.message.set(this.i18n.translate('admin.championships.deletedMessage'));
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
      .getChampionships()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ championships }) => this.championships.set(championships),
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  statusLabel(status: ChampionshipContent['status']): string {
    const keys: Record<ChampionshipContent['status'], string> = {
      draft: 'admin.championshipForm.statusDraft',
      registration: 'admin.championshipForm.statusRegistration',
      active: 'admin.championshipForm.statusActive',
      finished: 'admin.championshipForm.statusFinished',
      archived: 'admin.championshipForm.statusArchived',
    };
    return this.i18n.translate(keys[status]);
  }
}
