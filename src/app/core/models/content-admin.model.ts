export type MemberStatus = 'draft' | 'published' | 'archived';

export interface TeamMemberContent {
  id: string;
  slug: string;
  name: string;
  alias: string | null;
  roleLabel: string | null;
  bio: string | null;
  photoUrl: string | null;
  photoAlt: string | null;
  photoConsentConfirmed?: boolean;
  twitchUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  xUrl: string | null;
  displayOrder: number;
  isFeatured: boolean;
  isDemo: boolean;
  status: MemberStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName?: string | null;
}

export type ChampionshipStatus = 'draft' | 'registration' | 'active' | 'finished' | 'archived';
export type SyncStatus = 'never' | 'syncing' | 'success' | 'error';

export interface TournamentSourceSummary {
  id: number;
  name: string;
  rounds: number;
  drivers: number;
}

export interface SportsCorrection {
  id: string;
  reason: string;
  note: string;
  createdByName: string;
  createdAt: string;
}

export interface ChampionshipContent {
  id: string;
  externalTournamentId: number | null;
  slug: string;
  name: string;
  editionNumber: number | null;
  subtitle: string | null;
  season: string | null;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  coverMobileUrl?: string | null;
  coverAlt: string | null;
  backgroundVideoUrl: string | null;
  backgroundVideoMimeType: string | null;
  startAt: string | null;
  endAt: string | null;
  registrationUrl: string | null;
  rulesUrl: string | null;
  status: ChampionshipStatus;
  isFeatured: boolean;
  displayOrder: number;
  publishedAt: string | null;
  lastSyncedAt: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName?: string | null;
}

export interface SiteSettings {
  twitchChannelLogin: string;
  twitchChannelUrl: string;
  twitchChannels: TwitchChannelSetting[];
  featuredChampionshipId: string | null;
  contactEmail: string | null;
  discordUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  updatedAt: string;
  updatedByName?: string | null;
}

export interface TwitchChannelSetting {
  login: string;
  url: string;
  isOfficial: boolean;
  priority: number;
}

export interface AdminIdentity {
  id: string;
  email: string;
  displayName: string;
  role: 'admin';
  mfaEnabled?: boolean;
  emailVerified?: boolean;
}

export interface AdminSession {
  authenticated: boolean;
  needsSetup: boolean;
  admin: AdminIdentity | null;
  csrfToken: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

export interface DashboardSummary {
  members: { total: number; published: number; drafts: number; featured: number };
  championships: { total: number; drafts: number; sync_errors: number };
  featuredChampionship: ChampionshipContent | null;
}

export interface ApiProblem {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface MfaSetup {
  secret: string;
  otpauthUri: string;
}
