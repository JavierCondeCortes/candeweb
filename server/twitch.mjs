const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams';
const USERS_URL = 'https://api.twitch.tv/helix/users';
const CLIPS_URL = 'https://api.twitch.tv/helix/clips';
const STREAM_CACHE_MS = 90 * 1000;
const CONTENT_CACHE_MS = 15 * 60 * 1000;
const TOKEN_SAFETY_MS = 60 * 1000;

export function createTwitchStatusService(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const clientId = String(options.clientId ?? process.env.TWITCH_CLIENT_ID ?? '').trim();
  const clientSecret = String(
    options.clientSecret ?? process.env.TWITCH_CLIENT_SECRET ?? '',
  ).trim();
  let token = null;
  let tokenExpiresAt = 0;
  const streamCache = new Map();
  const contentCache = new Map();

  async function accessToken(forceRefresh = false) {
    if (!forceRefresh && token && tokenExpiresAt > now()) return token;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Twitch OAuth respondió ${response.status}.`);
    const payload = await response.json();
    if (!payload?.access_token || !Number.isFinite(Number(payload.expires_in))) {
      throw new Error('Twitch OAuth devolvió una respuesta no válida.');
    }
    token = String(payload.access_token);
    tokenExpiresAt = now() + Math.max(0, Number(payload.expires_in) * 1000 - TOKEN_SAFETY_MS);
    return token;
  }

  async function requestHelix(endpoint, retry = true) {
    const access = await accessToken(!retry);
    const response = await fetchImpl(endpoint, {
      headers: {
        Authorization: `Bearer ${access}`,
        'Client-Id': clientId,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 && retry) {
      token = null;
      tokenExpiresAt = 0;
      return requestHelix(endpoint, false);
    }
    if (!response.ok) throw new Error(`Twitch Helix respondió ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload?.data))
      throw new Error('Twitch Helix devolvió una respuesta no válida.');
    return payload.data;
  }

  async function requestStreams(channelLogins) {
    const endpoint = new URL(STREAMS_URL);
    channelLogins.forEach((channelLogin) =>
      endpoint.searchParams.append('user_login', channelLogin),
    );
    return requestHelix(endpoint);
  }

  async function getBestStatus({ channels }) {
    if (!clientId || !clientSecret) {
      throw new Error('La integración de Twitch no está configurada.');
    }
    const normalizedChannels = normalizeChannels(channels);
    const cacheKey = JSON.stringify(
      normalizedChannels.map(({ login, isOfficial, priority }) => ({
        login,
        isOfficial,
        priority,
      })),
    );
    const cached = streamCache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.value;

    const streams = await requestStreams(normalizedChannels.map((channel) => channel.login));
    const streamsByLogin = new Map(
      streams
        .map((stream) => [String(stream.user_login ?? '').toLowerCase(), stream])
        .filter(([login]) => login),
    );
    if (normalizedChannels.length === 1 && streams.length === 1 && streamsByLogin.size === 0) {
      streamsByLogin.set(normalizedChannels[0].login, streams[0]);
    }

    const selectedChannel =
      normalizedChannels.find((channel) => streamsByLogin.has(channel.login)) ??
      normalizedChannels[0];
    const stream = streamsByLogin.get(selectedChannel.login);
    const value = stream
      ? {
          live: true,
          channelName: String(stream.user_name || selectedChannel.name || selectedChannel.login),
          channelUrl: selectedChannel.url,
          title: String(stream.title || 'Directo de la comunidad'),
          category: String(stream.game_name || 'Twitch'),
          viewers: Math.max(0, Number(stream.viewer_count) || 0),
        }
      : {
          live: false,
          channelName: String(selectedChannel.name || selectedChannel.login),
          channelUrl: selectedChannel.url,
        };
    streamCache.set(cacheKey, { value, expiresAt: now() + STREAM_CACHE_MS });
    return value;
  }

  async function getChannelContent({ channelLogin, channelUrl }) {
    if (!clientId || !clientSecret) {
      throw new Error('La integración de Twitch no está configurada.');
    }
    const login = String(channelLogin ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(login)) throw new Error('El canal de Twitch no es válido.');
    const cached = contentCache.get(login);
    if (cached && cached.expiresAt > now()) return cached.value;

    const usersEndpoint = new URL(USERS_URL);
    usersEndpoint.searchParams.set('login', login);
    const users = await requestHelix(usersEndpoint);
    const user = users[0];
    if (!user?.id) throw new Error('Twitch no reconoce el canal configurado.');

    const clipsEndpoint = new URL(CLIPS_URL);
    clipsEndpoint.searchParams.set('broadcaster_id', String(user.id));
    clipsEndpoint.searchParams.set('first', '4');
    const clips = await requestHelix(clipsEndpoint);
    const value = {
      channel: {
        id: String(user.id),
        login: String(user.login || login),
        displayName: String(user.display_name || user.login || login),
        description: String(user.description || ''),
        profileImageUrl: httpsUrl(user.profile_image_url),
        offlineImageUrl: httpsUrl(user.offline_image_url),
        url: String(channelUrl || `https://www.twitch.tv/${login}`),
      },
      clips: clips
        .map((clip) => ({
          id: String(clip.id || ''),
          url: httpsUrl(clip.url),
          embedUrl: httpsUrl(clip.embed_url),
          title: String(clip.title || 'Clip de Candemor'),
          creatorName: String(clip.creator_name || ''),
          thumbnailUrl: httpsUrl(clip.thumbnail_url),
          viewCount: Math.max(0, Number(clip.view_count) || 0),
          createdAt: String(clip.created_at || ''),
          durationSeconds: Math.max(0, Number(clip.duration) || 0),
        }))
        .filter((clip) => clip.id && clip.url)
        .slice(0, 4),
      fetchedAt: new Date(now()).toISOString(),
    };
    contentCache.set(login, { value, expiresAt: now() + CONTENT_CACHE_MS });
    return value;
  }

  return {
    isConfigured() {
      return Boolean(clientId && clientSecret);
    },

    getBestStatus,
    getChannelContent,

    async getStatus({ channelLogin, channelName, channelUrl }) {
      return getBestStatus({
        channels: [
          {
            login: channelLogin,
            name: channelName,
            url: channelUrl,
            isOfficial: true,
            priority: 0,
          },
        ],
      });
    },
  };
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeChannels(channels) {
  const normalized = [];
  const seen = new Set();
  for (const [index, channel] of (Array.isArray(channels) ? channels : []).entries()) {
    const login = String(channel?.login ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(login)) throw new Error('El canal de Twitch no es válido.');
    if (seen.has(login)) continue;
    seen.add(login);
    normalized.push({
      login,
      name: String(channel?.name ?? login).trim() || login,
      url: String(channel?.url ?? `https://www.twitch.tv/${login}`),
      isOfficial: channel?.isOfficial === true,
      priority: Number.isSafeInteger(Number(channel?.priority)) ? Number(channel.priority) : index,
    });
    if (normalized.length === 6) break;
  }
  if (!normalized.length) throw new Error('Configura al menos un canal de Twitch.');
  return normalized.sort(
    (left, right) =>
      Number(right.isOfficial) - Number(left.isOfficial) || left.priority - right.priority,
  );
}
