import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditEntry } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-audit.html',
})
export class AdminAudit implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly i18n = inject(I18nService);
  readonly entries = signal<AuditEntry[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.api.getAudit().subscribe({
      next: ({ entries }) => this.entries.set(entries),
      error: (error) =>
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        ),
    });
  }
}
