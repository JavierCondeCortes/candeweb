import assert from 'node:assert/strict';
import test from 'node:test';
import { madridDateTimeToIso } from './timezone.mjs';

test('interpreta las fechas del panel en Europe/Madrid y conserva instantes con zona', () => {
  assert.equal(madridDateTimeToIso('2026-01-15T20:00'), '2026-01-15T19:00:00.000Z');
  assert.equal(madridDateTimeToIso('2026-07-15T20:00'), '2026-07-15T18:00:00.000Z');
  assert.equal(madridDateTimeToIso('2026-07-15T18:00:00Z'), '2026-07-15T18:00:00.000Z');
});

test('rechaza fechas imposibles y horas inexistentes durante el cambio a horario de verano', () => {
  assert.throws(() => madridDateTimeToIso('2026-02-30T20:00'), RangeError);
  assert.throws(() => madridDateTimeToIso('2026-03-29T02:30'), RangeError);
});
