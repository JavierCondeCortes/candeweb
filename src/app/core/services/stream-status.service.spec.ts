import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { filter, firstValueFrom, lastValueFrom } from 'rxjs';
import {
  STREAM_STATUS_ENDPOINT,
  StreamStatusService,
  TWITCH_CHANNEL_URL,
} from './stream-status.service';

describe('StreamStatusService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('returns an honest fallback during server-side rendering', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });

    const status = await firstValueFrom(TestBed.inject(StreamStatusService).status$);

    expect(status).toEqual({
      kind: 'unconfigured',
      channelName: 'CandemorRacingTeam',
      channelUrl: TWITCH_CHANNEL_URL,
    });
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('normalizes a live response returned by the server-side proxy', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STREAM_STATUS_ENDPOINT, useValue: '/api/stream-status' },
      ],
    });

    const result = lastValueFrom(TestBed.inject(StreamStatusService).status$);
    TestBed.inject(HttpTestingController).expectOne('/api/stream-status').flush({
      live: true,
      channelName: 'Candemor',
      channelUrl: TWITCH_CHANNEL_URL,
      title: 'Candeonato en directo',
      category: 'iRacing',
      viewers: 42,
    });

    await expect(result).resolves.toMatchObject({
      kind: 'live',
      channelName: 'Candemor',
      viewers: 42,
    });
  });

  it('falls back to the official player event when the server integration is unavailable', async () => {
    class FakeTwitchPlayer {
      static readonly ONLINE = 'online';
      static readonly OFFLINE = 'offline';
      static readonly READY = 'ready';

      private readonly listeners = new Map<string, () => void>();

      constructor() {
        queueMicrotask(() => this.listeners.get(FakeTwitchPlayer.ONLINE)?.());
      }

      addEventListener(event: string, listener: () => void): void {
        this.listeners.set(event, listener);
      }
    }

    const twitchWindow = window as unknown as { Twitch?: unknown };
    twitchWindow.Twitch = { Player: FakeTwitchPlayer };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STREAM_STATUS_ENDPOINT, useValue: '/api/public/stream-status' },
      ],
    });

    const statusPromise = firstValueFrom(
      TestBed.inject(StreamStatusService).status$.pipe(filter((value) => value.kind === 'live')),
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/public/stream-status')
      .flush('Sin credenciales', { status: 503, statusText: 'Unavailable' });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/public/site-settings')
      .flush({
        twitchChannelLogin: 'candemorracingteam',
        twitchChannelUrl: TWITCH_CHANNEL_URL,
        twitchChannels: [
          {
            login: 'candemorracingteam',
            url: TWITCH_CHANNEL_URL,
            isOfficial: true,
            priority: 0,
          },
        ],
      });
    const status = await statusPromise;

    expect(status).toMatchObject({
      kind: 'live',
      channelName: 'CandemorRacingTeam',
      channelUrl: TWITCH_CHANNEL_URL,
    });

    delete twitchWindow.Twitch;
  });
});
