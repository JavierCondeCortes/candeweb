export type StreamStatus =
  | { kind: 'loading' }
  | {
      kind: 'live';
      channelName: string;
      channelUrl: string;
      title: string;
      category: string;
      viewers?: number;
    }
  | { kind: 'offline'; channelName: string; channelUrl: string }
  | { kind: 'unconfigured'; channelName: string; channelUrl: string }
  | { kind: 'error'; channelName: string; channelUrl: string };

export interface StreamStatusResponse {
  live: boolean;
  channelName?: string;
  channelUrl?: string;
  title?: string;
  category?: string;
  viewers?: number;
}
