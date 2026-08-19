import assert from 'node:assert/strict';
import test from 'node:test';
import { createTwitchStatusService } from './twitch.mjs';

test('consulta Twitch Helix con token de aplicación y reutiliza la caché durante 90 segundos', async () => {
  let oauthRequests = 0;
  let streamRequests = 0;
  const fetchImpl = async (input, options) => {
    const url = String(input);
    if (url.includes('/oauth2/token')) {
      oauthRequests += 1;
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('grant_type'), 'client_credentials');
      return response({ access_token: 'app-token', expires_in: 3600 });
    }
    streamRequests += 1;
    assert.match(url, /user_login=candemorracingteam/);
    assert.equal(options.headers.Authorization, 'Bearer app-token');
    assert.equal(options.headers['Client-Id'], 'client-id');
    return response({
      data: [
        {
          user_name: 'CandemorRacingTeam',
          title: 'Candeonato en directo',
          game_name: 'iRacing',
          viewer_count: 42,
        },
      ],
    });
  };
  const service = createTwitchStatusService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl,
    now: () => 1_000_000,
  });

  const input = {
    channelLogin: 'candemorracingteam',
    channelName: 'CandemorRacingTeam',
    channelUrl: 'https://www.twitch.tv/candemorracingteam',
  };
  const first = await service.getStatus(input);
  const second = await service.getStatus(input);

  assert.equal(first.live, true);
  assert.equal(first.viewers, 42);
  assert.deepEqual(second, first);
  assert.equal(oauthRequests, 1);
  assert.equal(streamRequests, 1);
});

test('permanece desconfigurado sin publicar ni utilizar credenciales incompletas', () => {
  const service = createTwitchStatusService({ clientId: 'solo-client-id', clientSecret: '' });
  assert.equal(service.isConfigured(), false);
});

test('prioriza el canal oficial cuando varios canales configurados están en directo', async () => {
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url.includes('/oauth2/token')) {
      return response({ access_token: 'app-token', expires_in: 3600 });
    }
    const endpoint = new URL(url);
    assert.deepEqual(endpoint.searchParams.getAll('user_login'), [
      'candemorracingteam',
      'piloto_candemor',
    ]);
    return response({
      data: [
        {
          user_login: 'piloto_candemor',
          user_name: 'Piloto Candemor',
          title: 'Entrenamiento',
          game_name: 'iRacing',
          viewer_count: 10,
        },
        {
          user_login: 'candemorracingteam',
          user_name: 'CandemorRacingTeam',
          title: 'Candeonato oficial',
          game_name: 'iRacing',
          viewer_count: 42,
        },
      ],
    });
  };
  const service = createTwitchStatusService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl,
    now: () => 1_000_000,
  });

  const status = await service.getBestStatus({
    channels: [channel('candemorracingteam', true, 0), channel('piloto_candemor', false, 1)],
  });

  assert.equal(status.live, true);
  assert.equal(status.channelName, 'CandemorRacingTeam');
  assert.equal(status.title, 'Candeonato oficial');
});

test('muestra el siguiente canal por prioridad cuando el oficial está desconectado', async () => {
  const fetchImpl = async (input) => {
    if (String(input).includes('/oauth2/token')) {
      return response({ access_token: 'app-token', expires_in: 3600 });
    }
    return response({
      data: [
        {
          user_login: 'piloto_candemor',
          user_name: 'Piloto Candemor',
          title: 'Entrenamiento',
          game_name: 'iRacing',
          viewer_count: 10,
        },
      ],
    });
  };
  const service = createTwitchStatusService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl,
  });

  const status = await service.getBestStatus({
    channels: [channel('candemorracingteam', true, 0), channel('piloto_candemor', false, 1)],
  });

  assert.equal(status.live, true);
  assert.equal(status.channelName, 'Piloto Candemor');
  assert.equal(status.channelUrl, 'https://www.twitch.tv/piloto_candemor');
});

test('obtiene el perfil y los clips públicos del canal y los conserva quince minutos', async () => {
  const requests = [];
  const fetchImpl = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('/oauth2/token')) {
      return response({ access_token: 'app-token', expires_in: 3600 });
    }
    if (url.includes('/helix/users')) {
      assert.equal(new URL(url).searchParams.get('login'), 'candemorracingteam');
      return response({
        data: [
          {
            id: '1234',
            login: 'candemorracingteam',
            display_name: 'CandemorRacingTeam',
            description: 'Simracing y comunidad',
            profile_image_url: 'https://static-cdn.jtvnw.net/profile.png',
            offline_image_url: 'https://static-cdn.jtvnw.net/offline.jpg',
          },
        ],
      });
    }
    const endpoint = new URL(url);
    assert.equal(endpoint.pathname, '/helix/clips');
    assert.equal(endpoint.searchParams.get('broadcaster_id'), '1234');
    assert.equal(endpoint.searchParams.get('first'), '4');
    return response({
      data: [
        {
          id: '',
          url: 'javascript:alert(1)',
          title: 'Respuesta incompleta',
        },
        {
          id: 'clip-id',
          url: 'https://clips.twitch.tv/clip-id',
          embed_url: 'https://clips.twitch.tv/embed?clip=clip-id',
          title: 'Final del Candeonato',
          creator_name: 'CandemorFan',
          thumbnail_url: 'https://clips-media-assets2.twitch.tv/preview.jpg',
          view_count: 120,
          created_at: '2026-08-01T20:00:00Z',
          duration: 28.4,
        },
      ],
    });
  };
  const service = createTwitchStatusService({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl,
    now: () => 1_000_000,
  });

  const input = {
    channelLogin: 'candemorracingteam',
    channelUrl: 'https://www.twitch.tv/candemorracingteam',
  };
  const first = await service.getChannelContent(input);
  const second = await service.getChannelContent(input);

  assert.equal(first.channel.displayName, 'CandemorRacingTeam');
  assert.equal(first.clips.length, 1);
  assert.equal(first.clips[0].title, 'Final del Candeonato');
  assert.equal(first.clips[0].viewCount, 120);
  assert.deepEqual(second, first);
  assert.equal(requests.length, 3);
});

function channel(login, isOfficial, priority) {
  return {
    login,
    url: `https://www.twitch.tv/${login}`,
    isOfficial,
    priority,
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}
