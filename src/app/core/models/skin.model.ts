import { MemberStatus } from './content-admin.model';

export interface SkinContent {
  id: string;
  carName: string;
  imageUrl: string;
  imageAlt: string;
  targetUrl: string;
  displayOrder: number;
  status: MemberStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName?: string | null;
}

export type SkinInput = Omit<
  SkinContent,
  'id' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'updatedByName'
> & { updatedAt?: string };
