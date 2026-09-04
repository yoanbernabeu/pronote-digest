import type { PronoteFeed, PronoteLesson } from '../sources/pronote/parse.js';
import { holidayOn, resolveTarget, type TargetDay } from './calendar.js';
import { homeworkFor } from './homework.js';
import type { ChildDigest, Digest, DigestKind, IsoDate, Lesson } from './model.js';

export interface ChildFeed {
  name: string;
  feed: PronoteFeed;
}

export interface BuildDigestInput {
  kind: DigestKind;
  /** Jour où le digest est préparé, en heure de Paris. */
  today: IsoDate;
  generatedAt: string;
  children: ChildFeed[];
}

export interface BuildDigestResult {
  digest: Digest;
  target: TargetDay;
}

const SPORT = /SPORT|\bE\.?P\.?S\b/i;

function toLesson(lesson: PronoteLesson): Lesson {
  const result: Lesson = {
    id: lesson.id,
    start: lesson.start,
    end: lesson.end,
    subject: lesson.subject,
    teachers: lesson.teachers,
    rooms: lesson.rooms,
    status: lesson.status,
  };
  if (lesson.content !== undefined) result.content = lesson.content;
  return result;
}

function buildChild(child: ChildFeed, date: IsoDate): ChildDigest {
  const lessons = child.feed.lessons
    .filter((l) => l.start.startsWith(date))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(toLesson);
  const active = lessons.filter((l) => l.status !== 'cancelled');
  const flags: ChildDigest['flags'] = {
    hasSport: active.some((l) => SPORT.test(l.subject)),
    noSchool: lessons.length === 0,
  };
  const holiday = holidayOn(date, child.feed.events);
  if (holiday !== undefined) flags.holiday = holiday.label;
  const first = active[0];
  if (first !== undefined) {
    flags.firstStart = first.start;
    flags.lastEnd = active.reduce((max, l) => (l.end > max ? l.end : max), first.end);
  }
  return {
    name: child.name,
    lessons,
    homework: homeworkFor(child.feed.lessons, date),
    flags,
  };
}

export function buildDigest(input: BuildDigestInput): BuildDigestResult {
  const lessonDates = new Set<IsoDate>();
  const events = input.children.flatMap((c) => c.feed.events);
  for (const child of input.children) {
    for (const lesson of child.feed.lessons) lessonDates.add(lesson.start.slice(0, 10));
  }
  const target = resolveTarget(input.today, lessonDates, events);
  const digest: Digest = {
    version: 1,
    generatedAt: input.generatedAt,
    targetDate: target.date,
    kind: input.kind,
    schoolDay: target.kind === 'school-day',
    children: input.children.map((c) => buildChild(c, target.date)),
  };
  if (target.kind === 'no-school') {
    if (target.holiday !== undefined) digest.holiday = target.holiday;
    if (target.nextSchoolDay !== undefined) digest.nextSchoolDay = target.nextSchoolDay;
  }
  return { digest, target };
}
