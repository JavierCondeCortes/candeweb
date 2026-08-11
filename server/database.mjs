import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const now = () => new Date().toISOString();

export function openDatabase(databasePath) {
  const resolvedPath = resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role = 'admin'),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      totp_secret TEXT,
      totp_pending_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0, 1)),
      recovery_codes TEXT,
      email_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      alias TEXT,
      role_label TEXT,
      bio TEXT,
      photo_url TEXT,
      photo_alt TEXT,
      photo_consent_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (photo_consent_confirmed IN (0, 1)),
      twitch_url TEXT,
      instagram_url TEXT,
      youtube_url TEXT,
      x_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
      is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_name TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS championships (
      id TEXT PRIMARY KEY,
      external_tournament_id INTEGER UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      edition_number INTEGER,
      subtitle TEXT,
      season TEXT,
      summary TEXT,
      description TEXT,
      cover_url TEXT,
      cover_alt TEXT,
      background_video_url TEXT,
      background_video_mime_type TEXT,
      start_at TEXT,
      end_at TEXT,
      registration_url TEXT,
      rules_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'registration', 'active', 'finished', 'archived')
      ),
      is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
      display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
      published_at TEXT,
      last_synced_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'never' CHECK (
        sync_status IN ('never', 'syncing', 'success', 'error')
      ),
      sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_name TEXT,
      deleted_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS championships_one_featured
      ON championships(is_featured)
      WHERE is_featured = 1 AND deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS championship_snapshots (
      id TEXT PRIMARY KEY,
      championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      source_at TEXT,
      synced_at TEXT NOT NULL,
      is_final INTEGER NOT NULL DEFAULT 0 CHECK (is_final IN (0, 1)),
      UNIQUE(championship_id, checksum)
    );

    CREATE TABLE IF NOT EXISTS sports_corrections (
      id TEXT PRIMARY KEY,
      championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      note TEXT NOT NULL,
      created_by TEXT REFERENCES admin_profiles(id) ON DELETE SET NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      twitch_channel_login TEXT NOT NULL,
      twitch_channel_url TEXT NOT NULL,
      twitch_channels_json TEXT,
      featured_championship_id TEXT REFERENCES championships(id) ON DELETE SET NULL,
      contact_email TEXT,
      discord_url TEXT,
      instagram_url TEXT,
      youtube_url TEXT,
      updated_at TEXT NOT NULL,
      updated_by_name TEXT
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      public_url TEXT NOT NULL UNIQUE,
      storage_path TEXT NOT NULL UNIQUE,
      mobile_public_url TEXT,
      mobile_storage_path TEXT,
      original_storage_path TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      byte_size INTEGER NOT NULL,
      alt_text TEXT,
      entity_type TEXT CHECK (entity_type IN ('team_member', 'championship')),
      entity_id TEXT,
      uploaded_by TEXT NOT NULL REFERENCES admin_profiles(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES admin_profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS team_members_public_order
      ON team_members(status, is_featured, display_order);
    CREATE INDEX IF NOT EXISTS championships_public_order
      ON championships(status, display_order);
    CREATE INDEX IF NOT EXISTS snapshots_by_championship
      ON championship_snapshots(championship_id, synced_at DESC);
    CREATE INDEX IF NOT EXISTS corrections_by_championship
      ON sports_corrections(championship_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_recent
      ON audit_log(created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(
    now(),
  );
  const mediaColumns = db.prepare('PRAGMA table_info(media_assets)').all();
  if (!mediaColumns.some((column) => column.name === 'original_storage_path')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN original_storage_path TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (2, ?)').run(
    now(),
  );
  const adminColumns = db.prepare('PRAGMA table_info(admin_profiles)').all();
  if (!adminColumns.some((column) => column.name === 'totp_secret')) {
    db.exec('ALTER TABLE admin_profiles ADD COLUMN totp_secret TEXT;');
  }
  if (!adminColumns.some((column) => column.name === 'totp_pending_secret')) {
    db.exec('ALTER TABLE admin_profiles ADD COLUMN totp_pending_secret TEXT;');
  }
  if (!adminColumns.some((column) => column.name === 'totp_enabled')) {
    db.exec('ALTER TABLE admin_profiles ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;');
  }
  if (!adminColumns.some((column) => column.name === 'recovery_codes')) {
    db.exec('ALTER TABLE admin_profiles ADD COLUMN recovery_codes TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (3, ?)').run(
    now(),
  );
  const currentMediaColumns = db.prepare('PRAGMA table_info(media_assets)').all();
  if (!currentMediaColumns.some((column) => column.name === 'alt_text')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN alt_text TEXT;');
  }
  if (!currentMediaColumns.some((column) => column.name === 'entity_type')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN entity_type TEXT;');
  }
  if (!currentMediaColumns.some((column) => column.name === 'entity_id')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN entity_id TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (4, ?)').run(
    now(),
  );
  const currentAdminColumns = db.prepare('PRAGMA table_info(admin_profiles)').all();
  if (!currentAdminColumns.some((column) => column.name === 'email_verified_at')) {
    db.exec('ALTER TABLE admin_profiles ADD COLUMN email_verified_at TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (5, ?)').run(
    now(),
  );
  const currentMemberColumns = db.prepare('PRAGMA table_info(team_members)').all();
  if (!currentMemberColumns.some((column) => column.name === 'photo_consent_confirmed')) {
    db.exec(
      'ALTER TABLE team_members ADD COLUMN photo_consent_confirmed INTEGER NOT NULL DEFAULT 0;',
    );
    db.exec('UPDATE team_members SET photo_consent_confirmed = 1 WHERE is_demo = 1;');
  }
  if (!currentMemberColumns.some((column) => column.name === 'updated_by_name')) {
    db.exec('ALTER TABLE team_members ADD COLUMN updated_by_name TEXT;');
  }
  const currentChampionshipColumns = db.prepare('PRAGMA table_info(championships)').all();
  if (!currentChampionshipColumns.some((column) => column.name === 'updated_by_name')) {
    db.exec('ALTER TABLE championships ADD COLUMN updated_by_name TEXT;');
  }
  const currentSettingsColumns = db.prepare('PRAGMA table_info(site_settings)').all();
  if (!currentSettingsColumns.some((column) => column.name === 'updated_by_name')) {
    db.exec('ALTER TABLE site_settings ADD COLUMN updated_by_name TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (6, ?)').run(
    now(),
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS sports_corrections (
      id TEXT PRIMARY KEY,
      championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      note TEXT NOT NULL,
      created_by TEXT REFERENCES admin_profiles(id) ON DELETE SET NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS corrections_by_championship
      ON sports_corrections(championship_id, created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (7, ?)').run(
    now(),
  );
  const latestMediaColumns = db.prepare('PRAGMA table_info(media_assets)').all();
  if (!latestMediaColumns.some((column) => column.name === 'mobile_public_url')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN mobile_public_url TEXT;');
  }
  if (!latestMediaColumns.some((column) => column.name === 'mobile_storage_path')) {
    db.exec('ALTER TABLE media_assets ADD COLUMN mobile_storage_path TEXT;');
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (8, ?)').run(
    now(),
  );
  db.exec(`
    DELETE FROM admin_sessions
    WHERE admin_id NOT IN (
      SELECT id FROM admin_profiles WHERE role = 'admin'
      ORDER BY created_at ASC, id ASC LIMIT 1
    );
    UPDATE admin_profiles SET active = 0
    WHERE id NOT IN (
      SELECT id FROM admin_profiles WHERE role = 'admin'
      ORDER BY created_at ASC, id ASC LIMIT 1
    );
    DROP TABLE IF EXISTS admin_invitations;
    CREATE UNIQUE INDEX IF NOT EXISTS admin_one_active
      ON admin_profiles(active) WHERE active = 1;
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (9, ?)').run(
    now(),
  );
  const twitchSettingsColumns = db.prepare('PRAGMA table_info(site_settings)').all();
  if (!twitchSettingsColumns.some((column) => column.name === 'twitch_channels_json')) {
    db.exec('ALTER TABLE site_settings ADD COLUMN twitch_channels_json TEXT;');
  }
  const legacyTwitchSettings = db
    .prepare(
      `SELECT id, twitch_channel_login, twitch_channel_url FROM site_settings
       WHERE twitch_channels_json IS NULL OR twitch_channels_json = ''`,
    )
    .all();
  const updateTwitchChannels = db.prepare(
    'UPDATE site_settings SET twitch_channels_json = ? WHERE id = ?',
  );
  for (const settings of legacyTwitchSettings) {
    updateTwitchChannels.run(
      JSON.stringify([
        {
          login: settings.twitch_channel_login,
          url: settings.twitch_channel_url,
          isOfficial: true,
          priority: 0,
        },
      ]),
      settings.id,
    );
  }
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (10, ?)').run(
    now(),
  );
  db.prepare(
    `UPDATE championships
     SET status = 'finished', updated_at = ?
     WHERE external_tournament_id = 42
       AND status = 'active'
       AND updated_by_name = 'Sistema'`,
  ).run(now());
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (11, ?)').run(
    now(),
  );
  db.prepare(
    `UPDATE championships
     SET status = 'finished', updated_at = ?
     WHERE external_tournament_id = 42
       AND status = 'active'
       AND updated_by_name IS NULL
       AND NOT EXISTS (SELECT 1 FROM admin_profiles)`,
  ).run(now());
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (12, ?)').run(
    now(),
  );
  const communitySettingsColumns = db.prepare('PRAGMA table_info(site_settings)').all();
  if (!communitySettingsColumns.some((column) => column.name === 'discord_url')) {
    db.exec('ALTER TABLE site_settings ADD COLUMN discord_url TEXT;');
  }
  db.prepare(
    `UPDATE site_settings SET discord_url = ?
     WHERE discord_url IS NULL OR discord_url = ''`,
  ).run('https://discord.gg/j22XuDEfMk');
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (13, ?)').run(
    now(),
  );
  const championshipColumns = db.prepare('PRAGMA table_info(championships)').all();
  if (!championshipColumns.some((column) => column.name === 'background_video_url')) {
    db.exec('ALTER TABLE championships ADD COLUMN background_video_url TEXT;');
  }
  if (!championshipColumns.some((column) => column.name === 'background_video_mime_type')) {
    db.exec('ALTER TABLE championships ADD COLUMN background_video_mime_type TEXT;');
  }

  const migration14Applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 14').get();
  if (!migration14Applied) {
    const newEra = db
      .prepare('SELECT id FROM championships WHERE external_tournament_id = 42')
      .get();
    if (newEra) {
      const timestamp = now();
      db.prepare('UPDATE championships SET is_featured = 0 WHERE id != ?').run(newEra.id);
      db.prepare(
        `UPDATE championships
         SET slug = ?, name = ?, edition_number = 8, subtitle = ?, season = ?,
             summary = ?, description = ?, cover_url = ?, cover_alt = ?,
             background_video_url = ?, background_video_mime_type = ?,
             status = 'finished', is_featured = 1, display_order = 0,
             published_at = COALESCE(published_at, ?), updated_at = ?,
             updated_by_name = COALESCE(updated_by_name, 'Sistema')
         WHERE id = ?`,
      ).run(
        'candeonato-new-era',
        'Candeonato New Era',
        'New Era Edition',
        '2026',
        'Una nueva era del Candeonato: distintas carreras, una clasificación común y puntos acumulados.',
        'Competición de simracing organizada por Candemor Racing Team y gestionada mediante el sistema de Fat Cat Race.',
        '/media/hero-poster.webp',
        'Mazda MX-5 de competición de la edición New Era del Candeonato',
        '/media/hero-optimized.mp4',
        'video/mp4',
        timestamp,
        timestamp,
        newEra.id,
      );
      db.prepare(
        `UPDATE site_settings
         SET featured_championship_id = ?, updated_at = ?
         WHERE id = 1`,
      ).run(newEra.id, timestamp);
    }
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (14, ?)').run(now());
  }
}

function seed(db) {
  const timestamp = now();
  const existingChampionship = db
    .prepare('SELECT id FROM championships WHERE external_tournament_id = 42')
    .get();
  const championshipId = existingChampionship?.id ?? randomUUID();

  if (!existingChampionship) {
    db.prepare(
      `INSERT INTO championships (
        id, external_tournament_id, slug, name, edition_number, subtitle, season, summary,
        description, cover_url, cover_alt, background_video_url, background_video_mime_type,
        status, is_featured, display_order, published_at,
        created_at, updated_at, updated_by_name
      ) VALUES (?, 42, ?, ?, 8, ?, ?, ?, ?, ?, ?, ?, ?, 'finished', 1, 0, ?, ?, ?, 'Sistema')`,
    ).run(
      championshipId,
      'candeonato-new-era',
      'Candeonato New Era',
      'New Era Edition',
      '2026',
      'Una nueva era del Candeonato: distintas carreras, una clasificación común y puntos acumulados.',
      'Competición de simracing organizada por Candemor Racing Team y gestionada mediante el sistema de Fat Cat Race.',
      '/media/hero-poster.webp',
      'Mazda MX-5 de competición de la edición New Era del Candeonato',
      '/media/hero-optimized.mp4',
      'video/mp4',
      timestamp,
      timestamp,
      timestamp,
    );
  }

  const historicalChampionships = [
    [46, 'candeonato-its-my-life', "Candeonato it's my life"],
    [38, 'candeonato-mike-edition', 'Candeonato MIKE Edition'],
    [36, 'candeonato-super-hot-edition', 'Candeonato Super Hot Edition'],
    [35, 'candeonato-summer-edition', 'Candeonato Summer Edition'],
    [34, 'candeonato-spring-edition', 'Candeonato Spring Edition'],
  ];
  const insertHistoricalChampionship = db.prepare(
    `INSERT OR IGNORE INTO championships (
      id, external_tournament_id, slug, name, summary, status, is_featured, display_order,
      published_at, created_at, updated_at, updated_by_name
    ) VALUES (?, ?, ?, ?, ?, 'finished', 0, ?, ?, ?, ?, 'Sistema')`,
  );
  historicalChampionships.forEach(([externalId, slug, name], index) => {
    insertHistoricalChampionship.run(
      randomUUID(),
      externalId,
      slug,
      name,
      'Edición histórica del Candeonato con seis sesiones publicadas por la fuente deportiva.',
      index + 1,
      timestamp,
      timestamp,
      timestamp,
    );
  });

  db.prepare(
    `INSERT OR IGNORE INTO site_settings (
      id, twitch_channel_login, twitch_channel_url, twitch_channels_json,
      featured_championship_id, discord_url, updated_at, updated_by_name
    ) VALUES (1, ?, ?, ?, ?, ?, ?, 'Sistema')`,
  ).run(
    'candemorracingteam',
    'https://www.twitch.tv/candemorracingteam',
    JSON.stringify([
      {
        login: 'candemorracingteam',
        url: 'https://www.twitch.tv/candemorracingteam',
        isOfficial: true,
        priority: 0,
      },
    ]),
    championshipId,
    'https://discord.gg/j22XuDEfMk',
    timestamp,
  );

  const memberCount = Number(db.prepare('SELECT COUNT(*) AS count FROM team_members').get().count);
  if (memberCount > 0) return;

  const demoMembers = [
    ['alex-vega', 'Alex Vega', '/media/team/member-alex.webp', true],
    ['lucia-torres', 'Lucía Torres', '/media/team/member-lucia.webp', false],
    ['dani-romero', 'Dani Romero', '/media/team/member-dani.webp', true],
    ['nora-ruiz', 'Nora Ruiz', '/media/team/member-nora.webp', false],
    ['marcos-leon', 'Marcos León', '/media/team/member-marcos.webp', true],
  ];

  const insert = db.prepare(
    `INSERT INTO team_members (
      id, slug, name, photo_url, photo_alt, photo_consent_confirmed, twitch_url, display_order,
      is_featured, is_demo, status, published_at, created_at, updated_at, updated_by_name
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, 1, 'published', ?, ?, ?, 'Sistema')`,
  );

  db.exec('BEGIN');
  try {
    demoMembers.forEach(([slug, name, photoUrl, hasTwitch], index) => {
      insert.run(
        randomUUID(),
        slug,
        name,
        photoUrl,
        `Retrato ficticio de ${name} para demostrar el diseño del equipo`,
        hasTwitch ? 'https://www.twitch.tv/candemorracingteam' : null,
        index,
        timestamp,
        timestamp,
        timestamp,
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function recordAudit(db, actorId, action, entityType, entityId = null, details = null) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    details ? JSON.stringify(details) : null,
    now(),
  );
}

export function asBoolean(value) {
  return value === 1;
}

export function memberFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    alias: row.alias,
    roleLabel: row.role_label,
    bio: row.bio,
    photoUrl: row.photo_url,
    photoAlt: row.photo_alt,
    photoConsentConfirmed: asBoolean(row.photo_consent_confirmed),
    twitchUrl: row.twitch_url,
    instagramUrl: row.instagram_url,
    youtubeUrl: row.youtube_url,
    xUrl: row.x_url,
    displayOrder: row.display_order,
    isFeatured: asBoolean(row.is_featured),
    isDemo: asBoolean(row.is_demo),
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

export function championshipFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    externalTournamentId: row.external_tournament_id,
    slug: row.slug,
    name: row.name,
    editionNumber: row.edition_number,
    subtitle: row.subtitle,
    season: row.season,
    summary: row.summary,
    description: row.description,
    coverUrl: row.cover_url,
    coverMobileUrl: mobileCoverUrl(row.cover_url),
    coverAlt: row.cover_alt,
    backgroundVideoUrl: row.background_video_url,
    backgroundVideoMimeType: row.background_video_mime_type,
    startAt: row.start_at,
    endAt: row.end_at,
    registrationUrl: row.registration_url,
    rulesUrl: row.rules_url,
    status: row.status,
    isFeatured: asBoolean(row.is_featured),
    displayOrder: row.display_order,
    publishedAt: row.published_at,
    lastSyncedAt: row.last_synced_at,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

function mobileCoverUrl(coverUrl) {
  if (coverUrl === '/media/hero-poster.webp') return '/media/hero-poster-mobile.webp';
  return null;
}

export function settingsFromRow(row) {
  return {
    twitchChannelLogin: row.twitch_channel_login,
    twitchChannelUrl: row.twitch_channel_url,
    twitchChannels: twitchChannelsFromRow(row),
    featuredChampionshipId: row.featured_championship_id,
    contactEmail: row.contact_email,
    discordUrl: row.discord_url,
    instagramUrl: row.instagram_url,
    youtubeUrl: row.youtube_url,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

function twitchChannelsFromRow(row) {
  try {
    const parsed = JSON.parse(row.twitch_channels_json ?? '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((channel) => channel && typeof channel.login === 'string')
        .map((channel, index) => ({
          login: channel.login,
          url:
            typeof channel.url === 'string' && channel.url
              ? channel.url
              : `https://www.twitch.tv/${channel.login}`,
          isOfficial: channel.isOfficial === true || index === 0,
          priority: Number.isSafeInteger(Number(channel.priority))
            ? Number(channel.priority)
            : index,
        }));
    }
  } catch {
    // A legacy or manually edited row falls back to the original primary fields.
  }
  return [
    {
      login: row.twitch_channel_login,
      url: row.twitch_channel_url,
      isOfficial: true,
      priority: 0,
    },
  ];
}
