import type { IsoDate, SchoolEvent } from './model.js';

export type TargetDay =
  | { kind: 'school-day'; date: IsoDate }
  | { kind: 'no-school'; date: IsoDate; holiday?: string; nextSchoolDay?: IsoDate };

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function holidayOn(date: IsoDate, events: SchoolEvent[]): SchoolEvent | undefined {
  return events.find((e) => e.from <= date && date < e.to);
}

function nextSchoolDayAfter(date: IsoDate, lessonDates: ReadonlySet<IsoDate>): IsoDate | undefined {
  const candidates = [...lessonDates].filter((d) => d > date).sort();
  return candidates[0];
}

/**
 * Détermine le jour visé par le digest préparé le soir de `today`.
 * Les jours de classe sont ceux qui portent au moins un cours dans le flux,
 * ce qui couvre naturellement week-ends, fériés, vacances et journées banalisées.
 */
export function resolveTarget(
  today: IsoDate,
  lessonDates: ReadonlySet<IsoDate>,
  events: SchoolEvent[],
): TargetDay {
  const tomorrow = addDays(today, 1);
  if (lessonDates.has(tomorrow)) return { kind: 'school-day', date: tomorrow };

  const next = nextSchoolDayAfter(today, lessonDates);
  if (lessonDates.has(today) && next !== undefined) return { kind: 'school-day', date: next };

  const result: TargetDay = { kind: 'no-school', date: tomorrow };
  const holiday = holidayOn(tomorrow, events);
  if (holiday !== undefined) result.holiday = holiday.label;
  if (next !== undefined) result.nextSchoolDay = next;
  return result;
}
