import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SkinContent } from '../../../core/models/skin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-skins',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './admin-skins.html',
})
export class AdminSkins implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly i18n = inject(I18nService);
  readonly skins = signal<SkinContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly errorMessage = signal('');
  readonly message = signal('');
  readonly query = signal('');
  readonly filteredSkins = computed(() => {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    return this.skins().filter((skin) =>
      skin.carName.toLocaleLowerCase(this.i18n.language()).includes(query),
    );
  });

  ngOnInit(): void {
    this.api
      .getSkins()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ skins }) => this.skins.set(skins),
        error: (error) => this.showError(error),
      });
  }

  runAction(skin: SkinContent, action: 'publish' | 'archive'): void {
    if (
      action === 'archive' &&
      !window.confirm(this.i18n.translate('admin.skins.confirmArchive', { name: skin.carName }))
    ) return;
    this.busyId.set(skin.id);
    this.api
      .skinAction(skin.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: ({ skin: updated }) => {
          this.skins.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
          this.message.set(
            this.i18n.translate(
              action === 'publish' ? 'admin.skins.publishedMessage' : 'admin.skins.archivedMessage',
            ),
          );
        },
        error: (error) => this.showError(error),
      });
  }

  deleteSkin(skin: SkinContent): void {
    if (!window.confirm(this.i18n.translate('admin.skins.confirmDelete', { name: skin.carName }))) return;
    this.busyId.set(skin.id);
    this.api
      .deleteSkin(skin.id)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.skins.update((items) => items.filter((item) => item.id !== skin.id));
          this.message.set(this.i18n.translate('admin.skins.deletedMessage'));
        },
        error: (error) => this.showError(error),
      });
  }

  statusLabel(status: SkinContent['status']): string {
    return this.i18n.translate(`admin.common.${status}`);
  }

  private showError(error: unknown): void {
    this.errorMessage.set(
      apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
        this.i18n.translate(key),
      ),
    );
  }
}
