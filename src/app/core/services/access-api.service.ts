import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { MfaSetup } from '../models/content-admin.model';
import { SetupInvitation, SetupSession } from '../models/setup.model';
import { SkinContent } from '../models/skin.model';

@Injectable({ providedIn: 'root' })
export class AccessApiService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<SetupSession | null>(null);

  readonly session = this.sessionState.asReadonly();

  refreshSession() {
    return this.http
      .get<SetupSession>('/api/access/session', { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  login(input: { email: string; password: string; mfaCode: string; rememberMe: boolean }) {
    return this.http
      .post<SetupSession>('/api/access/login', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  logout() {
    return this.http
      .post<void>('/api/access/logout', {}, this.options(true))
      .pipe(tap(() => this.sessionState.set(null)));
  }

  requestAccess(input: { displayName: string; email: string }) {
    return this.http.post<{ requested: boolean }>('/api/access/requests', input);
  }

  verifyInvitation(token: string) {
    return this.http.get<{ invitation: SetupInvitation }>(
      `/api/access/invitations/verify?token=${encodeURIComponent(token)}`,
    );
  }

  acceptInvitation(input: { token: string; password: string }) {
    return this.http
      .post<SetupSession>('/api/access/invitations/accept', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  startMfaSetup() {
    return this.http.post<MfaSetup>('/api/access/mfa/setup', {}, this.options(true));
  }

  confirmMfa(code: string) {
    return this.http.post<{ recoveryCodes: string[] }>(
      '/api/access/mfa/confirm',
      { code },
      this.options(true),
    );
  }

  getSkins() {
    return this.http.get<{ skins: SkinContent[] }>('/api/skins', this.options());
  }

  private options(mutating = false) {
    const csrfToken = this.sessionState()?.csrfToken;
    const headers =
      mutating && csrfToken ? new HttpHeaders({ 'X-CSRF-Token': csrfToken }) : undefined;
    return { withCredentials: true, headers };
  }
}
