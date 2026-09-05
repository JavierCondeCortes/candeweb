import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  AdminSession,
  AccessInvitationEmailTemplate,
  AdminAccessRequest,
  AdminAccount,
  AdminInvitation,
  AuditEntry,
  ChampionshipContent,
  DashboardSummary,
  MfaSetup,
  SiteSettings,
  SponsorContent,
  SportsCorrection,
  TeamMemberContent,
  TournamentSourceSummary,
  EmailDelivery,
  EmailTemplateConfiguration,
  EmailTemplatePreview,
} from '../models/content-admin.model';
import { ManagedSetupAccount, SetupAccessRequest, SetupInvitation } from '../models/setup.model';
import { SkinContent, SkinInput } from '../models/skin.model';

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

  login(input: { email: string; password: string; mfaCode?: string; rememberMe: boolean }) {
    return this.http
      .post<AdminSession>('/api/admin/login', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set({ ...session, needsSetup: false })));
  }

  requestAccess(input: { displayName: string; email: string }) {
    return this.http.post<{ requested: boolean }>('/api/admin/access-requests', input);
  }

  verifyInvitation(token: string) {
    return this.http.get<{ invitation: AdminInvitation }>(
      `/api/admin/invitations/verify?token=${encodeURIComponent(token)}`,
    );
  }

  acceptInvitation(input: { token: string; password: string }) {
    return this.http
      .post<AdminSession>('/api/admin/invitations/accept', input, { withCredentials: true })
      .pipe(tap((session) => this.sessionState.set(session)));
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

  getSkins() {
    return this.http.get<{ skins: SkinContent[] }>('/api/admin/skins', this.options());
  }

  getSkin(id: string) {
    return this.http.get<{ skin: SkinContent }>(
      `/api/admin/skins/${encodeURIComponent(id)}`,
      this.options(),
    );
  }

  createSkin(skin: SkinInput) {
    return this.http.post<{ skin: SkinContent }>('/api/admin/skins', skin, this.options(true));
  }

  updateSkin(id: string, skin: SkinInput) {
    return this.http.patch<{ skin: SkinContent }>(
      `/api/admin/skins/${encodeURIComponent(id)}`,
      skin,
      this.options(true),
    );
  }

  deleteSkin(id: string) {
    return this.http.delete<void>(`/api/admin/skins/${encodeURIComponent(id)}`, this.options(true));
  }

  skinAction(id: string, action: 'publish' | 'archive') {
    return this.http.post<{ skin: SkinContent }>(
      `/api/admin/skins/${encodeURIComponent(id)}/${action}`,
      {},
      this.options(true),
    );
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

  deleteChampionship(id: string) {
    return this.http.delete<void>(
      `/api/admin/championships/${encodeURIComponent(id)}`,
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

  getAdminUsers() {
    return this.http.get<{ users: AdminAccount[]; requests: AdminAccessRequest[] }>(
      '/api/admin/users',
      this.options(),
    );
  }

  approveAccessRequest(id: string) {
    return this.http.post<{ invitation: AdminInvitation }>(
      `/api/admin/access-requests/${encodeURIComponent(id)}/approve`,
      {},
      this.options(true),
    );
  }

  rejectAccessRequest(id: string) {
    return this.http.post<void>(
      `/api/admin/access-requests/${encodeURIComponent(id)}/reject`,
      {},
      this.options(true),
    );
  }

  setAdminActive(id: string, active: boolean) {
    return this.http.patch<{ user: AdminAccount }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      { active },
      this.options(true),
    );
  }

  revokeAdminSessions(id: string) {
    return this.http.post<void>(
      `/api/admin/users/${encodeURIComponent(id)}/revoke-sessions`,
      {},
      this.options(true),
    );
  }

  getAccessManagement() {
    return this.http.get<{
      users: ManagedSetupAccount[];
      requests: SetupAccessRequest[];
      storage: { usedBytes: number; expiringFiles: number };
    }>('/api/access/users', this.options());
  }

  getAccessInvitationEmailTemplate() {
    return this.http.get<EmailTemplateConfiguration>(
      '/api/admin/email-templates/access-invitation',
      this.options(),
    );
  }

  updateAccessInvitationEmailTemplate(input: AccessInvitationEmailTemplate) {
    return this.http.patch<EmailTemplateConfiguration>(
      '/api/admin/email-templates/access-invitation',
      input,
      this.options(true),
    );
  }

  resetAccessInvitationEmailTemplate() {
    return this.http.delete<EmailTemplateConfiguration>(
      '/api/admin/email-templates/access-invitation',
      this.options(true),
    );
  }

  previewAccessInvitationEmail(input: AccessInvitationEmailTemplate) {
    return this.http.post<{ preview: EmailTemplatePreview }>(
      '/api/admin/email-templates/access-invitation/preview',
      input,
      this.options(true),
    );
  }

  sendAccessInvitationEmailTest(input: AccessInvitationEmailTemplate) {
    return this.http.post<{ delivery: EmailDelivery }>(
      '/api/admin/email-templates/access-invitation/test',
      input,
      this.options(true),
    );
  }

  approveProductAccessRequest(id: string) {
    return this.http.post<{
      invitation: SetupInvitation | null;
      emailDelivery: import('../models/setup.model').EmailDelivery;
    }>(`/api/access/requests/${encodeURIComponent(id)}/approve`, {}, this.options(true));
  }

  rejectProductAccessRequest(id: string) {
    return this.http.post<void>(
      `/api/access/requests/${encodeURIComponent(id)}/reject`,
      {},
      this.options(true),
    );
  }

  updateProductPermissions(
    id: string,
    permissions: {
      canAccessSkins: boolean;
      canAccessSetups: boolean;
      canUploadSetups: boolean;
    },
  ) {
    return this.http.patch<{ user: ManagedSetupAccount }>(
      `/api/access/users/${encodeURIComponent(id)}`,
      permissions,
      this.options(true),
    );
  }

  setProductAccountActive(id: string, active: boolean) {
    return this.http.post<{ user: ManagedSetupAccount }>(
      `/api/access/users/${encodeURIComponent(id)}/${active ? 'restore' : 'revoke'}`,
      {},
      this.options(true),
    );
  }

  async uploadImage(
    file: File,
    kind: 'member' | 'championship' | 'sponsor' | 'skin',
    altText = '',
  ) {
    return this.uploadMedia<{ publicUrl: string }>(file, kind, altText);
  }

  async uploadVideo(file: File) {
    return this.uploadMedia<{ publicUrl: string; mimeType: string }>(file, 'championship-video');
  }

  private uploadMedia<T>(file: File, kind: string, altText = '') {
    const query = new URLSearchParams({
      fileName: file.name,
      kind,
      altText,
    });
    const options = this.options(true);
    const headers = (options.headers ?? new HttpHeaders()).set(
      'Content-Type',
      file.type || 'application/octet-stream',
    );
    return this.http.post<{ asset: T }>(`/api/admin/media?${query.toString()}`, file, {
      ...options,
      headers,
    });
  }

  private options(mutating = false) {
    const csrfToken = this.sessionState()?.csrfToken;
    const headers =
      mutating && csrfToken ? new HttpHeaders({ 'X-CSRF-Token': csrfToken }) : undefined;
    return { withCredentials: true, headers };
  }
}
