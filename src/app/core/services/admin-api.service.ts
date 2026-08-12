import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  AdminSession,
  AuditEntry,
  ChampionshipContent,
  DashboardSummary,
  MfaSetup,
  SiteSettings,
  SponsorContent,
  SportsCorrection,
  TeamMemberContent,
  TournamentSourceSummary,
} from '../models/content-admin.model';

type MemberInput = Omit<
  TeamMemberContent,
  'id' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'updatedByName'
> & {
  updatedAt?: string;
};
type ChampionshipInput = Omit<
  ChampionshipContent,
  | 'id'
  | 'publishedAt'
  | 'lastSyncedAt'
  | 'syncStatus'
  | 'syncError'
  | 'createdAt'
  | 'updatedAt'
  | 'updatedByName'
  | 'coverMobileUrl'
> & { updatedAt?: string };
type SponsorInput = Omit<
  SponsorContent,
  'id' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'updatedByName'
> & { updatedAt?: string };

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AdminSession | null>(null);

  readonly session = this.sessionState.asReadonly();

  refreshSession() {
    return this.http
      .get<AdminSession>('/api/admin/session', { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
  }

  setup(input: { email: string; displayName: string; password: string; setupToken?: string }) {
    return this.http
      .post<AdminSession>('/api/admin/setup', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set({ ...session, needsSetup: false })));
  }

  login(input: { email: string; password: string; mfaCode?: string }) {
    return this.http
      .post<AdminSession>('/api/admin/login', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set({ ...session, needsSetup: false })));
  }

  startMfaSetup() {
    return this.http.post<MfaSetup>('/api/admin/mfa/setup', {}, this.options(true));
  }

  confirmMfa(code: string) {
    return this.http.post<{ recoveryCodes: string[] }>(
      '/api/admin/mfa/confirm',
      { code },
      this.options(true),
    );
  }

  logout() {
    return this.http
      .post<void>('/api/admin/logout', {}, this.options(true))
      .pipe(tap(() => this.sessionState.set(null)));
  }

  getDashboard() {
    return this.http.get<DashboardSummary>('/api/admin/dashboard', this.options());
  }

  getMembers() {
    return this.http.get<{ members: TeamMemberContent[] }>('/api/admin/members', this.options());
  }

  getMember(id: string) {
    return this.http.get<{ member: TeamMemberContent }>(
      `/api/admin/members/${encodeURIComponent(id)}`,
      this.options(),
    );
  }

  createMember(member: MemberInput) {
    return this.http.post<{ member: TeamMemberContent }>(
      '/api/admin/members',
      member,
      this.options(true),
    );
  }

  updateMember(id: string, member: MemberInput) {
    return this.http.patch<{ member: TeamMemberContent }>(
      `/api/admin/members/${encodeURIComponent(id)}`,
      member,
      this.options(true),
    );
  }

  deleteMember(id: string) {
    return this.http.delete<void>(
      `/api/admin/members/${encodeURIComponent(id)}`,
      this.options(true),
    );
  }

  memberAction(id: string, action: 'publish' | 'archive') {
    return this.http.post<{ member: TeamMemberContent }>(
      `/api/admin/members/${encodeURIComponent(id)}/${action}`,
      {},
      this.options(true),
    );
  }

  reorderMembers(ids: string[]) {
    return this.http.patch<void>('/api/admin/members/order', { ids }, this.options(true));
  }

  getSponsors() {
    return this.http.get<{ sponsors: SponsorContent[] }>('/api/admin/sponsors', this.options());
  }

  getSponsor(id: string) {
    return this.http.get<{ sponsor: SponsorContent }>(
      `/api/admin/sponsors/${encodeURIComponent(id)}`,
      this.options(),
    );
  }

  createSponsor(sponsor: SponsorInput) {
    return this.http.post<{ sponsor: SponsorContent }>(
      '/api/admin/sponsors',
      sponsor,
      this.options(true),
    );
  }

  updateSponsor(id: string, sponsor: SponsorInput) {
    return this.http.patch<{ sponsor: SponsorContent }>(
      `/api/admin/sponsors/${encodeURIComponent(id)}`,
      sponsor,
      this.options(true),
    );
  }

  deleteSponsor(id: string) {
    return this.http.delete<void>(
      `/api/admin/sponsors/${encodeURIComponent(id)}`,
      this.options(true),
    );
  }

  sponsorAction(id: string, action: 'publish' | 'archive') {
    return this.http.post<{ sponsor: SponsorContent }>(
      `/api/admin/sponsors/${encodeURIComponent(id)}/${action}`,
      {},
      this.options(true),
    );
  }

  getChampionships() {
    return this.http.get<{ championships: ChampionshipContent[] }>(
      '/api/admin/championships',
      this.options(),
    );
  }

  getChampionship(id: string) {
    return this.http.get<{ championship: ChampionshipContent }>(
      `/api/admin/championships/${encodeURIComponent(id)}`,
      this.options(),
    );
  }

  validateTournamentSource(externalTournamentId: number) {
    return this.http.post<{ tournament: TournamentSourceSummary }>(
      '/api/admin/championships/validate-source',
      { externalTournamentId },
      this.options(true),
    );
  }

  createChampionship(championship: ChampionshipInput) {
    return this.http.post<{ championship: ChampionshipContent }>(
      '/api/admin/championships',
      championship,
      this.options(true),
    );
  }

  updateChampionship(id: string, championship: ChampionshipInput) {
    return this.http.patch<{ championship: ChampionshipContent }>(
      `/api/admin/championships/${encodeURIComponent(id)}`,
      championship,
      this.options(true),
    );
  }

  championshipAction(id: string, action: 'publish' | 'archive' | 'feature' | 'sync') {
    return this.http.post<{ championship: ChampionshipContent }>(
      `/api/admin/championships/${encodeURIComponent(id)}/${action}`,
      {},
      this.options(true),
    );
  }

  getChampionshipCorrections(id: string) {
    return this.http.get<{ corrections: SportsCorrection[] }>(
      `/api/admin/championships/${encodeURIComponent(id)}/corrections`,
      this.options(),
    );
  }

  createChampionshipCorrection(id: string, input: { reason: string; note: string }) {
    return this.http.post<{ correction: SportsCorrection }>(
      `/api/admin/championships/${encodeURIComponent(id)}/corrections`,
      input,
      this.options(true),
    );
  }

  getSettings() {
    return this.http.get<{ settings: SiteSettings }>('/api/admin/settings', this.options());
  }

  updateSettings(settings: SiteSettings) {
    return this.http.patch<{ settings: SiteSettings }>(
      '/api/admin/settings',
      settings,
      this.options(true),
    );
  }

  getAudit() {
    return this.http.get<{ entries: AuditEntry[] }>('/api/admin/audit', this.options());
  }

  async uploadImage(file: File, kind: 'member' | 'championship' | 'sponsor', altText = '') {
    const dataBase64 = await fileToDataUrl(file);
    return this.http.post<{ asset: { publicUrl: string } }>(
      '/api/admin/media',
      { fileName: file.name, mimeType: file.type, dataBase64, kind, altText },
      this.options(true),
    );
  }

  async uploadVideo(file: File) {
    const dataBase64 = await fileToDataUrl(file);
    return this.http.post<{ asset: { publicUrl: string; mimeType: string } }>(
      '/api/admin/media',
      {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
        kind: 'championship-video',
      },
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('No se pudo leer el archivo.')),
    );
    reader.readAsDataURL(file);
  });
}
