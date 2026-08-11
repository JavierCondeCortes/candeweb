export interface TwitchChannelContent {
  channel: {
    id: string;
    login: string;
    displayName: string;
    description: string;
    profileImageUrl: string | null;
    offlineImageUrl: string | null;
    url: string;
  };
  clips: TwitchClipContent[];
  fetchedAt: string;
}

export interface TwitchClipContent {
  id: string;
  url: string | null;
  embedUrl: string | null;
  title: string;
  creatorName: string;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
  durationSeconds: number;
}
