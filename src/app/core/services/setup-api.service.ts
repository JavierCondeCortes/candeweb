import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  ManagedSetupAccount,
  RacingSetup,
  SetupAccessRequest,
  SetupCapabilities,
  SetupFile,
  SetupInput,
  SetupInvitation,
  SetupSession,
  SetupSessionType,
} from '../models/setup.model';

@Injectable({ providedIn: 'root' })
export class SetupApiService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<SetupSession | null>(null);

  readonly session = this.sessionState.asReadonly();

  refreshSession() {
    return this.http
      .get<SetupSession>('/api/setup-access/session', { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  login(input: { email: string; password: string; mfaCode?: string }) {
    return this.http
      .post<SetupSession>('/api/setup-access/login', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  logout() {
    return this.http
      .post<void>('/api/setup-access/logout', {}, this.options(true))
      .pipe(tap(() => this.sessionState.set(null)));
  }

  requestAccess(input: { displayName: string; email: string }) {
    return this.http.post<{ requested: boolean }>('/api/setup-access/requests', input);
  }

  verifyInvitation(token: string) {
    return this.http.get<{ invitation: SetupInvitation }>(
      `/api/setup-access/invitations/verify?token=${encodeURIComponent(token)}`,
    );
  }

  acceptInvitation(input: { token: string; password: string }) {
    return this.http
      .post<SetupSession>('/api/setup-access/invitations/accept', input, {
        withCredentials: true,
      })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  getSetups(filters: { q?: string; simulator?: string } = {}) {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.simulator) query.set('simulator', filters.simulator);
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.http.get<{ setups: RacingSetup[]; capabilities: SetupCapabilities }>(
      `/api/setups${suffix}`,
      this.options(),
    );
  }

  getSetup(id: string) {
    return this.http.get<{ setup: RacingSetup; capabilities: SetupCapabilities }>(
      `/api/setups/${encodeURIComponent(id)}`,
      this.options(),
    );
  }

  createSetup(input: SetupInput) {
    return this.http.post<{ setup: RacingSetup }>('/api/setups', input, this.options(true));
  }

  updateSetup(id: string, input: SetupInput) {
    return this.http.patch<{ setup: RacingSetup }>(
      `/api/setups/${encodeURIComponent(id)}`,
      input,
      this.options(true),
    );
  }

  deleteSetup(id: string) {
    return this.http.delete<void>(`/api/setups/${encodeURIComponent(id)}`, this.options(true));
  }

  setupAction(id: string, action: 'publish' | 'archive') {
    return this.http.post<{ setup: RacingSetup }>(
      `/api/setups/${encodeURIComponent(id)}/${action}`,
      {},
      this.options(true),
    );
  }

  uploadFile(
    setupId: string,
    file: File,
    input: {
      sessionType: SetupSessionType;
      notes?: string;
      retentionDays?: number | null;
    },
  ) {
    const query = new URLSearchParams({ fileName: file.name, sessionType: input.sessionType });
    if (input.notes) query.set('notes', input.notes);
    if (input.retentionDays) query.set('retentionDays', String(input.retentionDays));
    const options = this.options(true);
    const headers = (options.headers ?? new HttpHeaders()).set(
      'Content-Type',
      file.type || 'application/octet-stream',
    );
    return this.http.post<{ file: SetupFile; setup: RacingSetup }>(
      `/api/setups/${encodeURIComponent(setupId)}/files?${query.toString()}`,
      file,
      { ...options, headers },
    );
  }

  updateRetention(setupId: string, fileId: string, retentionDays: number | null) {
    return this.http.patch<{ file: SetupFile }>(
      `/api/setups/${encodeURIComponent(setupId)}/files/${encodeURIComponent(fileId)}/retention`,
      { retentionDays },
      this.options(true),
    );
  }

  deleteFile(setupId: string, fileId: string) {
    return this.http.delete<void>(
      `/api/setups/${encodeURIComponent(setupId)}/files/${encodeURIComponent(fileId)}`,
      this.options(true),
    );
  }

  downloadUrl(setupId: string, fileId: string) {
    return `/api/setups/${encodeURIComponent(setupId)}/files/${encodeURIComponent(fileId)}/download`;
  }

  getAccessManagement() {
    return this.http.get<{
      users: ManagedSetupAccount[];
      requests: SetupAccessRequest[];
      storage: { usedBytes: number; expiringFiles: number };
    }>('/api/setup-access/users', this.options());
  }

  approveRequest(id: string) {
    return this.http.post<{ activated: boolean; invitation: SetupInvitation | null }>(
      `/api/setup-access/requests/${encodeURIComponent(id)}/approve`,
      {},
      this.options(true),
    );
  }

  rejectRequest(id: string) {
    return this.http.post<void>(
      `/api/setup-access/requests/${encodeURIComponent(id)}/reject`,
      {},
      this.options(true),
    );
  }

  updatePermissions(id: string, canAccessSetups: boolean, canUploadSetups: boolean) {
    return this.http.patch<{ user: ManagedSetupAccount }>(
      `/api/setup-access/users/${encodeURIComponent(id)}`,
      { canAccessSetups, canUploadSetups },
      this.options(true),
    );
  }

  private options(mutating = false) {
    const csrfToken = this.sessionState()?.csrfToken;
    const headers =
      mutating && csrfToken ? new HttpHeaders({ 'X-CSRF-Token': csrfToken }) : undefined;
    return { withCredentials: true, headers };
  }
}
