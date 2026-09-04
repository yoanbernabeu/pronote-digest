import { describe, expect, it } from 'vitest';
import {
  ChildDigestSchema,
  DigestSchema,
  HomeworkSchema,
  LessonSchema,
  SchoolEventSchema,
} from '../../src/core/model.js';

describe('LessonSchema', () => {
  it('accepts a regular lesson', () => {
    const lesson = LessonSchema.parse({
      id: 'Cours-1',
      start: '2026-09-07T08:00:00+02:00',
      end: '2026-09-07T08:55:00+02:00',
      subject: 'FRANCAIS',
      teachers: ['MARTIN A.'],
      rooms: ['S109'],
      status: 'scheduled',
    });
    expect(lesson.status).toBe('scheduled');
  });

  it('rejects an unknown status', () => {
    expect(() =>
      LessonSchema.parse({
        id: 'x',
        start: '2026-09-07T08:00:00+02:00',
        end: '2026-09-07T08:55:00+02:00',
        subject: 'X',
        teachers: [],
        rooms: [],
        status: 'weird',
      }),
    ).toThrow();
  });

  it('rejects a lesson ending before it starts', () => {
    expect(() =>
      LessonSchema.parse({
        id: 'x',
        start: '2026-09-07T09:00:00+02:00',
        end: '2026-09-07T08:00:00+02:00',
        subject: 'X',
        teachers: [],
        rooms: [],
        status: 'scheduled',
      }),
    ).toThrow();
  });
});

describe('HomeworkSchema', () => {
  it('accepts a homework with a due date and an assigned date', () => {
    const hw = HomeworkSchema.parse({
      id: 'hw-1',
      subject: 'MATHEMATIQUES',
      teachers: ['BERNARD B.'],
      assignedOn: '2026-09-03',
      dueOn: '2026-09-08',
      text: 'signer la charte',
      html: '<div>signer la charte</div>',
    });
    expect(hw.dueOn).toBe('2026-09-08');
  });

  it('rejects an invalid date', () => {
    expect(() =>
      HomeworkSchema.parse({
        id: 'hw-1',
        subject: 'X',
        teachers: [],
        assignedOn: '03/09/2026',
        dueOn: '2026-09-08',
        text: 'x',
        html: 'x',
      }),
    ).toThrow();
  });
});

describe('SchoolEventSchema', () => {
  it('accepts a holiday period with an exclusive end', () => {
    const ev = SchoolEventSchema.parse({
      kind: 'holiday',
      label: 'Vacances',
      from: '2026-10-18',
      to: '2026-11-02',
    });
    expect(ev.kind).toBe('holiday');
  });
});

describe('DigestSchema', () => {
  it('builds a complete digest and round-trips through JSON', () => {
    const child = ChildDigestSchema.parse({
      name: 'Alice',
      lessons: [],
      homework: [],
      flags: { hasSport: false, noSchool: true },
    });
    const digest = DigestSchema.parse({
      version: 1,
      generatedAt: '2026-09-06T17:00:00Z',
      targetDate: '2026-09-07',
      kind: 'planning',
      schoolDay: true,
      children: [child],
    });
    expect(DigestSchema.parse(JSON.parse(JSON.stringify(digest)))).toEqual(digest);
  });

  it('rejects an unknown digest kind', () => {
    expect(() =>
      DigestSchema.parse({
        version: 1,
        generatedAt: '2026-09-06T17:00:00Z',
        targetDate: '2026-09-07',
        kind: 'grades',
        schoolDay: true,
        children: [],
      }),
    ).toThrow();
  });
});
