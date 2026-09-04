import { describe, expect, it } from 'vitest';
import { addDays, holidayOn, resolveTarget } from '../../src/core/calendar.js';
import type { SchoolEvent } from '../../src/core/model.js';

const events: SchoolEvent[] = [
  { kind: 'holiday', label: 'Vacances', from: '2026-10-18', to: '2026-11-02' },
  { kind: 'public-holiday', label: 'Férié', from: '2026-11-11', to: '2026-11-12' },
];

// Semaine du 7 au 11 septembre, puis 14 au 16, le 16 octobre, reprise le 2 novembre, 10 et 12 novembre.
const lessonDates = new Set([
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-10-16',
  '2026-11-02',
  '2026-11-10',
  '2026-11-12',
]);

describe('addDays', () => {
  it('ajoute des jours à une date calendaire', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('holidayOn', () => {
  it('trouve la période couvrant une date, fin exclusive', () => {
    expect(holidayOn('2026-10-18', events)?.label).toBe('Vacances');
    expect(holidayOn('2026-11-01', events)?.label).toBe('Vacances');
    expect(holidayOn('2026-11-02', events)).toBeUndefined();
  });
});

describe('resolveTarget', () => {
  it('vise demain quand demain est un jour de classe', () => {
    expect(resolveTarget('2026-09-07', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-09-08',
    });
  });

  it('vise lundi quand on est vendredi', () => {
    expect(resolveTarget('2026-09-11', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-09-14',
    });
  });

  it('ne vise rien le samedi', () => {
    expect(resolveTarget('2026-09-12', lessonDates, events)).toEqual({
      kind: 'no-school',
      date: '2026-09-13',
      nextSchoolDay: '2026-09-14',
    });
  });

  it('vise lundi le dimanche soir', () => {
    expect(resolveTarget('2026-09-13', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-09-14',
    });
  });

  it('vise le jour de reprise la veille des vacances', () => {
    expect(resolveTarget('2026-10-16', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-11-02',
    });
  });

  it('signale les vacances pendant la période', () => {
    expect(resolveTarget('2026-10-24', lessonDates, events)).toEqual({
      kind: 'no-school',
      date: '2026-10-25',
      holiday: 'Vacances',
      nextSchoolDay: '2026-11-02',
    });
  });

  it('vise la reprise le dimanche de fin de vacances', () => {
    expect(resolveTarget('2026-11-01', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-11-02',
    });
  });

  it('saute un jour férié en semaine', () => {
    expect(resolveTarget('2026-11-10', lessonDates, events)).toEqual({
      kind: 'school-day',
      date: '2026-11-12',
    });
  });

  it('ne trouve pas de reprise après la fin du flux', () => {
    expect(resolveTarget('2026-11-13', lessonDates, events)).toEqual({
      kind: 'no-school',
      date: '2026-11-14',
    });
  });
});
