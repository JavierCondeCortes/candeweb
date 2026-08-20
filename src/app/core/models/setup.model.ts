export type SetupRole = 'owner' | 'admin' | 'user';
export type SetupStatus = 'draft' | 'published' | 'archived' | 'expired';
export type SetupSessionType = 'race' | 'qualifying' | 'wet' | 'endurance' | 'other';

export interface SetupAccount {
  id: string;
  email: string;
  displayName: string;
  role: SetupRole;
  canAccessSetups: boolean;
  canUploadSetups: boolean;
  mfaEnabled: boolean;
}

export interface SetupSession {
  authenticated: boolean;
  account: SetupAccount | null;
  csrfToken: string | null;
}

export interface SetupFile {
  id: string;
  setupId: string;
  versionNumber: number;
  originalName: string;
  extension: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  notes: string | null;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
  retentionDays: number | null;
  expiresAt: string | null;
  downloadCount: number | null;
}

export interface RacingSetup {
  id: string;
  title: string;
  simulator: string;
  car: string;
  track: string;
  configuration: string | null;
  sessionType: SetupSessionType;
  description: string | null;
  tags: string[];
  status: SetupStatus;
  createdBy: string;
  createdByName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeFileCount: number;
  canEdit: boolean;
  canManage: boolean;
  files?: SetupFile[];
}

export interface SetupCapabilities {
  canAccess: boolean;
  canUpload: boolean;
  canManage: boolean;
}

export interface SetupInput {
  title: string;
  simulator: string;
  car: string;
  track: string;
  configuration: string;
  sessionType: SetupSessionType;
  description: string;
  tags: string[];
  updatedAt?: string;
}

export type SetupAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SetupAccessRequest {
  id: string;
  email: string;
  displayName: string;
  status: SetupAccessRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface ManagedSetupAccount extends SetupAccount {
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetupInvitation {
  email: string;
  displayName?: string;
  path?: string;
  expiresAt: string;
}
