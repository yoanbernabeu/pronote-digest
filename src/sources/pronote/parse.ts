import { TZDate } from '@date-fns/tz';
import { formatISO } from 'date-fns';
import { decodeHTML } from 'entities';
import { convert } from 'html-to-text';
import ical, { type VEvent } from 'node-ical';
import type { IsoDate, LessonStatus, SchoolEvent } from '../../core/model.js';

const PARIS = 'Europe/Paris';

interface HomeworkBlock {
  /** `due` : bloc « Pour le » (échéance). `assigned` : bloc « Donné le » (origine). */
  kind: 'due' | 'assigned';
  date: IsoDate;
  html: string;
  text: string;
}

export interface PronoteLesson {
  id: string;
  start: string;
  end: string;
  subject: string;
  teachers: string[];
  rooms: string[];
  group?: string;
  status: LessonStatus;
  content?: string;
  homeworkBlocks: HomeworkBlock[];
}

export interface PronoteFeed {
  calendarName: string;
  lessons: PronoteLesson[];
  events: SchoolEvent[];
  /** Vrai si au moins un cours porte un contenu pédagogique ou un devoir. */
  hasHomeworkData: boolean;
}

type IcalValue = string | { val: string } | undefined;

function text(value: IcalValue): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : value.val;
}

function toParisIso(date: Date): string {
  return formatISO(new TZDate(date, PARIS));
}

function toLocalIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function frDateToIso(fr: string): IsoDate {
  const [d, m, y] = fr.split('/');
  return `${y}-${m}-${d}`;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function htmlToText(html: string): string {
  return convert(html, { wordwrap: false, preserveNewlines: false }).trim();
}

function statusFromCategories(categories: string[]): LessonStatus {
  const joined = categories.join(' ');
  if (joined.includes('annulé')) return 'cancelled';
  if (joined.includes('déplacé')) return 'moved';
  return 'scheduled';
}

interface ParsedDescription {
  subject: string;
  teachers: string[];
  rooms: string[];
  group?: string;
  content?: string;
  homeworkBlocks: HomeworkBlock[];
}

const HEADER_KEYS: Record<
  string,
  keyof Pick<ParsedDescription, 'subject' | 'teachers' | 'rooms' | 'group'>
> = {
  Matière: 'subject',
  Professeur: 'teachers',
  Professeurs: 'teachers',
  Salle: 'rooms',
  Salles: 'rooms',
  Groupe: 'group',
};

/** Libellés générés par Pronote, en gras, qui délimitent les sections du cahier de textes. */
const SECTION_LABEL =
  /<strong>(Contenu pédagogique|Pour le (\d{2}\/\d{2}\/\d{4})|Donné le (\d{2}\/\d{2}\/\d{4})) : \n?<\/strong>/g;

function parseDescription(raw: string, fallbackSubject: string): ParsedDescription {
  const result: ParsedDescription = {
    subject: fallbackSubject,
    teachers: [],
    rooms: [],
    homeworkBlocks: [],
  };
  const firstStrong = raw.search(/<strong>/);
  const header = firstStrong === -1 ? raw : raw.slice(0, firstStrong);
  const body = firstStrong === -1 ? '' : raw.slice(firstStrong);

  for (const line of header.split('\n')) {
    const sep = line.indexOf(' : ');
    if (sep === -1) continue;
    const key = HEADER_KEYS[line.slice(0, sep).trim()];
    const value = decodeHTML(line.slice(sep + 3).trim());
    if (key === undefined || value.length === 0) continue;
    if (key === 'teachers' || key === 'rooms') result[key] = splitList(value);
    else result[key] = value;
  }

  const matches = [...body.matchAll(SECTION_LABEL)];
  matches.forEach((match, index) => {
    const next = matches[index + 1];
    const sectionHtml = body
      .slice(match.index + match[0].length, next?.index ?? body.length)
      .trim();
    const [, label, dueFr, assignedFr] = match;
    if (label === 'Contenu pédagogique') {
      result.content = htmlToText(sectionHtml);
    } else if (dueFr !== undefined) {
      result.homeworkBlocks.push({
        kind: 'due',
        date: frDateToIso(dueFr),
        html: sectionHtml,
        text: htmlToText(sectionHtml),
      });
    } else if (assignedFr !== undefined) {
      result.homeworkBlocks.push({
        kind: 'assigned',
        date: frDateToIso(assignedFr),
        html: sectionHtml,
        text: htmlToText(sectionHtml),
      });
    }
  });
  return result;
}

/** node-ical ignore les propriétés X-WR-* porteuses de paramètres : on lit le nom sur le texte brut. */
function readCalendarName(source: string): string {
  const unfolded = source.replace(/\r?\n[ \t]/g, '');
  const match = unfolded.match(/^X-WR-CALNAME(?:;[^:]*)?:(.*)$/m);
  return match?.[1]?.trim() ?? '';
}

/** `Cours-16027-1-20260904T120218Z-Index-Education` → `Cours-16027-1` : l'horodatage est celui de l'export. */
function stableUid(uid: string): string {
  return uid.replace(/-\d{8}T\d{6}Z-Index-Education$/, '');
}

function eventKind(summary: string): SchoolEvent['kind'] {
  return /féri/i.test(summary) ? 'public-holiday' : 'holiday';
}

export function parsePronoteIcs(source: string): PronoteFeed {
  if (!source.includes('BEGIN:VCALENDAR')) {
    throw new Error('Le contenu reçu n’est pas un calendrier iCalendar (VCALENDAR absent).');
  }
  const parsed = ical.sync.parseICS(source);
  const components = Object.values(parsed).filter((c) => c !== undefined);
  const vevents = components.filter((c): c is VEvent => c.type === 'VEVENT');
  if (vevents.length === 0) {
    throw new Error('Le calendrier ne contient aucun événement.');
  }

  const lessons: PronoteLesson[] = [];
  const events: SchoolEvent[] = [];

  for (const ev of vevents) {
    const categories = (ev.categories ?? []).map(String);
    const summary = text(ev.summary as IcalValue);
    if (ev.start === undefined || ev.end === undefined) continue;
    if (ev.datetype === 'date') {
      events.push({
        kind: eventKind(summary),
        label: summary,
        from: toLocalIsoDate(ev.start),
        to: toLocalIsoDate(ev.end),
      });
      continue;
    }
    const description = parseDescription(text(ev.description as IcalValue), summary);
    const location = splitList(text(ev.location as IcalValue));
    const lesson: PronoteLesson = {
      id: stableUid(ev.uid),
      start: toParisIso(ev.start),
      end: toParisIso(ev.end),
      subject: description.subject,
      teachers: description.teachers,
      rooms: location.length > 0 ? location : description.rooms,
      status: statusFromCategories(categories),
      homeworkBlocks: description.homeworkBlocks,
    };
    if (description.group !== undefined) lesson.group = description.group;
    if (description.content !== undefined) lesson.content = description.content;
    lessons.push(lesson);
  }

  return {
    calendarName: readCalendarName(source),
    lessons,
    events,
    hasHomeworkData: lessons.some((l) => l.homeworkBlocks.length > 0 || l.content !== undefined),
  };
}
