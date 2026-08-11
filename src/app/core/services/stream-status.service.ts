import { HttpClient } from '@angular/common/http';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, InjectionToken, PLATFORM_ID } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, startWith, switchMap, timeout } from 'rxjs';
import { StreamStatus, StreamStatusResponse } from '../models/stream-status.model';

export const TWITCH_CHANNEL_LOGIN = 'candemorracingteam';
export const TWITCH_CHANNEL_NAME = 'CandemorRacingTeam';
export const TWITCH_CHANNEL_URL = `https://www.twitch.tv/${TWITCH_CHANNEL_LOGIN}`;

/**
 * Configure this token with the URL of a server-side endpoint that talks to Twitch.
 * Twitch credentials must never be added to the Angular application.
 */
export const STREAM_STATUS_ENDPOINT = new InjectionToken<string>('STREAM_STATUS_ENDPOINT', {
  providedIn: 'root',
  factory: () => '',
});

const TWITCH_PLAYER_SCRIPT = 'https://player.twitch.tv/js/embed/v1.js';

interface TwitchPlayerOptions {
  channel: string;
  width: number;
  height: number;
  autoplay: boolean;
  muted: boolean;
  parent: string[];
}

interface TwitchPlayerInstance {
  addEventListener(event: string, listener: () => void): void;
}

interface TwitchPlayerConstructor {
  new (elementId: string, options: TwitchPlayerOptions): TwitchPlayerInstance;
  readonly OFFLINE: string;
  readonly ONLINE: string;
  readonly READY: string;
}

interface TwitchWindow extends Window {
  Twitch?: { Player: TwitchPlayerConstructor };
}

interface TwitchChannelConfig {
  login: string;
  name: string;
  url: string;
}

interface TwitchSettingsResponse {
  twitchChannelLogin: string;
  twitchChannelUrl: string;
  twitchChannels?: Array<{
    login: string;
    url: string;
    isOfficial: boolean;
    priority: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class StreamStatusService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(STREAM_STATUS_ENDPOINT);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private probeSequence = 0;

  readonly status$: Observable<StreamStatus> = this.createStatusStream();

  private createStatusStream(): Observable<StreamStatus> {
    if (!isPlatformBrowser(this.platformId)) return of(this.unconfiguredStatus(fallbackChannel));
    if (!this.endpoint.trim()) {
      return this.loadChannel().pipe(
        switchMap((channel) => this.createPlayerStatusStream(channel)),
      );
    }

    return this.http.get<StreamStatusResponse>(this.endpoint).pipe(
      timeout(5000),
      map((response) => this.normalizeServerStatus(response)),
      catchError(() =>
        this.loadChannel().pipe(switchMap((channel) => this.createPlayerStatusStream(channel))),
      ),
      startWith<StreamStatus>({ kind: 'loading' }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private loadChannel(): Observable<TwitchChannelConfig> {
    return this.http.get<TwitchSettingsResponse>('/api/public/site-settings').pipe(
      timeout(3000),
      map((settings) => {
        const primary = [...(settings.twitchChannels ?? [])].sort(
          (left, right) =>
            Number(right.isOfficial) - Number(left.isOfficial) || left.priority - right.priority,
        )[0];
        const login = primary?.login || settings.twitchChannelLogin || TWITCH_CHANNEL_LOGIN;
        return {
          login,
          name: login === TWITCH_CHANNEL_LOGIN ? TWITCH_CHANNEL_NAME : login,
          url: primary?.url || settings.twitchChannelUrl || TWITCH_CHANNEL_URL,
        };
      }),
      catchError(() => of(fallbackChannel)),
    );
  }

  private normalizeServerStatus(response: StreamStatusResponse): StreamStatus {
    if (!response.live) {
      return {
        kind: 'offline',
        channelName: response.channelName ?? TWITCH_CHANNEL_NAME,
        channelUrl: response.channelUrl ?? TWITCH_CHANNEL_URL,
      };
    }
    if (!response.channelName) {
      return {
        kind: 'error',
        channelName: TWITCH_CHANNEL_NAME,
        channelUrl: TWITCH_CHANNEL_URL,
      };
    }
    return {
      kind: 'live',
      channelName: response.channelName,
      channelUrl: response.channelUrl || TWITCH_CHANNEL_URL,
      title: response.title ?? 'Directo de la comunidad',
      category: response.category ?? 'Simracing',
      viewers: Math.max(0, response.viewers ?? 0),
    };
  }

  private createPlayerStatusStream(channel: TwitchChannelConfig): Observable<StreamStatus> {
    return new Observable<StreamStatus>((subscriber) => {
      const browserWindow = this.document.defaultView as TwitchWindow | null;
      if (!browserWindow) {
        subscriber.next(this.unconfiguredStatus(channel));
        subscriber.complete();
        return;
      }

      subscriber.next({ kind: 'loading' });

      let disposed = false;
      let probe: HTMLDivElement | undefined;
      let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

      this.loadTwitchPlayer(browserWindow)
        .then((Player) => {
          if (disposed) return;

          probe = this.createPlayerProbe();
          const player = new Player(probe.id, {
            channel: channel.login,
            width: 400,
            height: 300,
            autoplay: false,
            muted: true,
            parent: [browserWindow.location.hostname],
          });

          const clearFallback = (): void => {
            if (fallbackTimer) clearTimeout(fallbackTimer);
          };

          player.addEventListener(Player.ONLINE, () => {
            clearFallback();
            subscriber.next({
              kind: 'live',
              channelName: channel.name,
              channelUrl: channel.url,
              title: 'Candemor está emitiendo ahora mismo',
              category: 'Twitch',
            });
          });

          player.addEventListener(Player.OFFLINE, () => {
            clearFallback();
            subscriber.next({
              kind: 'offline',
              channelName: channel.name,
              channelUrl: channel.url,
            });
          });

          fallbackTimer = setTimeout(() => subscriber.next(this.unconfiguredStatus(channel)), 8000);
        })
        .catch(() => {
          if (!disposed) {
            subscriber.next({
              kind: 'error',
              channelName: channel.name,
              channelUrl: channel.url,
            });
          }
        });

      return () => {
        disposed = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        probe?.remove();
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  private loadTwitchPlayer(browserWindow: TwitchWindow): Promise<TwitchPlayerConstructor> {
    if (browserWindow.Twitch?.Player) return Promise.resolve(browserWindow.Twitch.Player);

    return new Promise<TwitchPlayerConstructor>((resolve, reject) => {
      const resolvePlayer = (): void => {
        const Player = browserWindow.Twitch?.Player;
        if (Player) resolve(Player);
        else reject(new Error('La API del reproductor de Twitch no está disponible.'));
      };

      const existingScript = this.document.querySelector<HTMLScriptElement>(
        `script[src="${TWITCH_PLAYER_SCRIPT}"]`,
      );

      if (existingScript) {
        existingScript.addEventListener('load', resolvePlayer, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = this.document.createElement('script');
      script.src = TWITCH_PLAYER_SCRIPT;
      script.async = true;
      script.addEventListener('load', resolvePlayer, { once: true });
      script.addEventListener('error', reject, { once: true });
      this.document.head.append(script);
    });
  }

  private createPlayerProbe(): HTMLDivElement {
    const probe = this.document.createElement('div');
    probe.id = `twitch-status-probe-${++this.probeSequence}`;
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('inert', '');
    probe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:400px;height:300px;overflow:hidden;opacity:.001;pointer-events:none;';
    this.document.body.append(probe);
    return probe;
  }

  private unconfiguredStatus(channel: TwitchChannelConfig): StreamStatus {
    return {
      kind: 'unconfigured',
      channelName: channel.name,
      channelUrl: channel.url,
    };
  }
}

const fallbackChannel: TwitchChannelConfig = {
  login: TWITCH_CHANNEL_LOGIN,
  name: TWITCH_CHANNEL_NAME,
  url: TWITCH_CHANNEL_URL,
};
