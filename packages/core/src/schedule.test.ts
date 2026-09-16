import { describe, expect, it } from 'vitest';
import { parseManilaSchedule } from './schedule';

describe('explicit Asia/Manila schedules', () => {
  it('crosses the UTC date and year boundaries without relying on the machine timezone', () => {
    expect(parseManilaSchedule('2027-01-01T00:00')?.toISOString()).toBe('2026-12-31T16:00:00.000Z');
    expect(parseManilaSchedule('2026-09-09T07:59')?.toISOString()).toBe('2026-09-08T23:59:00.000Z');
    expect(parseManilaSchedule('2026-09-09T08:00')?.toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });
  it('accepts valid leap days and rejects calendar rollover', () => {
    expect(parseManilaSchedule('2028-02-29T23:59')?.toISOString()).toBe('2028-02-29T15:59:00.000Z');
    for (const value of ['2027-02-29T12:00', '2028-02-30T12:00', '2026-04-31T12:00', '2026-13-01T12:00', '2026-09-09T24:00', '2026-09-09T12:60']) {
      expect(parseManilaSchedule(value), value).toBeNull();
    }
  });
  it('rejects ambiguous or non-local-input formats', () => {
    for (const value of [undefined, null, 123, '', '09/09/2026 12:00', '2026-09-09', '2026-09-09T12:00Z', '2026-09-09T12:00+08:00']) {
      expect(parseManilaSchedule(value)).toBeNull();
    }
  });
});
