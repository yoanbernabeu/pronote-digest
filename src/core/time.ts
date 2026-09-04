import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { IsoDate } from './model.js';

const PARIS = 'Europe/Paris';

/** « 08:55 » en heure de Paris. */
export function timeHM(iso: string): string {
  return format(new TZDate(iso, PARIS), 'HH:mm');
}

/** « 08:55–09:50 ». */
export function timeRange(startIso: string, endIso: string): string {
  return `${timeHM(startIso)}–${timeHM(endIso)}`;
}

/** « lundi 7 septembre 2026 ». */
export function longDate(date: IsoDate): string {
  return format(new TZDate(`${date}T12:00:00`, PARIS), 'EEEE d MMMM yyyy', { locale: fr });
}

/** Date calendaire de Paris pour un instant donné. */
export function parisDate(instant: Date): IsoDate {
  return format(new TZDate(instant, PARIS), 'yyyy-MM-dd');
}

/** Heure de Paris (0–23) pour un instant donné. */
export function parisHour(instant: Date): number {
  return Number(format(new TZDate(instant, PARIS), 'H'));
}
