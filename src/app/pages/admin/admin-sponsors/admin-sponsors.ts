import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { SponsorContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-sponsors',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './admin-sponsors.html',
})
export class AdminSponsors implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly confirmation = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly sponsors = signal<SponsorContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly errorMessage = signal('');
  readonly message = signal('');
  readonly query = signal('');
  readonly filteredSponsors = computed(() => {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    return this.sponsors().filter((sponsor) =>
      [sponsor.name, sponsor.description]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase(this.i18n.language()).includes(query)),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  async runAction(sponsor: SponsorContent, action: 'publish' | 'archive'): Promise<void> {
    if (
      action === 'archive' &&
      !(await this.confirmation.confirm({
        message: this.i18n.translate('admin.sponsors.confirmArchive', { name: sponsor.name }),
        confirmLabel: this.i18n.translate('admin.common.archive'),
      }))
    )
      return;
    this.busyId.set(sponsor.id);
    this.errorMessage.set('');
    this.api
      .sponsorAction(sponsor.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: ({ sponsor: updated }) => {
          this.sponsors.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.message.set(
            this.i18n.translate(
              action === 'publish'
                ? 'admin.sponsors.publishedMessage'
                : 'admin.sponsors.archivedMessage',
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

  async deleteSponsor(sponsor: SponsorContent): Promise<void> {
    if (
      !(await this.confirmation.confirm({
        message: this.i18n.translate('admin.sponsors.confirmDelete', { name: sponsor.name }),
        confirmLabel: this.i18n.translate('admin.common.delete'),
        tone: 'danger',
      }))
    )
      return;
    this.busyId.set(sponsor.id);
    this.api
      .deleteSponsor(sponsor.id)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.sponsors.update((items) => items.filter((item) => item.id !== sponsor.id));
          this.message.set(this.i18n.translate('admin.sponsors.deletedMessage'));
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
      .getSponsors()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ sponsors }) => this.sponsors.set(sponsors),
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  statusLabel(status: SponsorContent['status']): string {
    return this.i18n.translate(`admin.common.${status}`);
  }
}
