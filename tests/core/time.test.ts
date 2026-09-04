import { describe, expect, it } from 'vitest';
import { longDate, parisDate, parisHour, timeHM, timeRange } from '../../src/core/time.js';

describe('time', () => {
  it('formate une heure en heure de Paris, été comme hiver', () => {
    expect(timeHM('2026-09-07T06:00:00Z')).toBe('08:00');
    expect(timeHM('2026-11-12T08:00:00Z')).toBe('09:00');
  });

  it('formate une plage horaire', () => {
    expect(timeRange('2026-09-07T08:00:00+02:00', '2026-09-07T08:55:00+02:00')).toBe('08:00–08:55');
  });

  it('formate une date longue en français', () => {
    expect(longDate('2026-09-07')).toBe('lundi 7 septembre 2026');
  });

  it('donne la date et l’heure de Paris d’un instant', () => {
    const lateEvening = new Date('2026-09-06T22:30:00Z');
    expect(parisDate(lateEvening)).toBe('2026-09-07');
    expect(parisHour(lateEvening)).toBe(0);
    expect(parisHour(new Date('2026-09-06T17:05:00Z'))).toBe(19);
  });
});
