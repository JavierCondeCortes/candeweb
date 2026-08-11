import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditEntry } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe],
  templateUrl: './admin-audit.html',
})
export class AdminAudit implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly entries = signal<AuditEntry[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.api.getAudit().subscribe({
      next: ({ entries }) => this.entries.set(entries),
      error: (error) => this.errorMessage.set(apiErrorMessage(error)),
    });
  }
}
