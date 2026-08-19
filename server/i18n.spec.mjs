import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { validateChampionship } from './validation.mjs';

test('creates the championship translation table and seeds the English featured content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'candeweb-i18n-'));
  const databasePath = join(directory, 'content.db');
  try {
    const db = openDatabase(databasePath);
    const translation = db
      .prepare(
        `SELECT summary, description, cover_alt
         FROM championship_translations WHERE locale = 'en'`,
      )
      .get();

    assert.match(translation.summary, /new era/i);
    assert.match(translation.description, /simracing competition/i);
    assert.match(translation.cover_alt, /Mazda MX-5/i);
    assert.ok(
      db.prepare('SELECT 1 FROM schema_migrations WHERE version = 16').get(),
      'migration 16 should be registered',
    );
    db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('validates and preserves English editorial championship fields', () => {
  const championship = validateChampionship({
    name: 'Candeonato bilingüe',
    summaryEn: 'English summary',
    descriptionEn: 'English description',
    coverAltEn: 'English cover alternative text',
    status: 'draft',
    displayOrder: 0,
  });

  assert.equal(championship.summaryEn, 'English summary');
  assert.equal(championship.descriptionEn, 'English description');
  assert.equal(championship.coverAltEn, 'English cover alternative text');
});
