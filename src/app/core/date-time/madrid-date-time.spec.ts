import { madridDateTimeLocalValue } from './madrid-date-time';

describe('madridDateTimeLocalValue', () => {
  it('formats stored UTC instants as mainland Spain local time in winter and summer', () => {
    expect(madridDateTimeLocalValue('2026-01-15T19:00:00.000Z')).toBe('2026-01-15T20:00');
    expect(madridDateTimeLocalValue('2026-07-15T18:00:00.000Z')).toBe('2026-07-15T20:00');
  });

  it('returns an empty control value for absent or invalid dates', () => {
    expect(madridDateTimeLocalValue(null)).toBe('');
    expect(madridDateTimeLocalValue('not-a-date')).toBe('');
  });
});
