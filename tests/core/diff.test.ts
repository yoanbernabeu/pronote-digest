import { describe, expect, it } from 'vitest';
import { diffDigests } from '../../src/core/diff.js';
import type { ChildDigest, Digest, Homework, Lesson } from '../../src/core/model.js';

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    start: '2026-09-07T08:00:00+02:00',
    end: '2026-09-07T08:55:00+02:00',
    subject: 'FRANCAIS',
    teachers: ['MARTIN A.'],
    rooms: ['S109'],
    status: 'scheduled',
    ...overrides,
  };
}

function homework(overrides: Partial<Homework> = {}): Homework {
  return {
    id: 'h1',
    subject: 'MATHEMATIQUES',
    teachers: ['BERNARD B.'],
    assignedOn: '2026-09-03',
    dueOn: '2026-09-07',
    text: 'signer la charte',
    html: '<div>signer la charte</div>',
    ...overrides,
  };
}

function digest(
  children: Partial<ChildDigest>[],
  targetDate = '2026-09-07',
  kind: Digest['kind'] = 'planning',
): Digest {
  return {
    version: 1,
    generatedAt: '2026-09-06T17:00:00.000Z',
    targetDate,
    kind,
    schoolDay: true,
    changes: [],
    children: children.map((c) => ({
      name: 'Alice',
      lessons: [],
      homework: [],
      flags: { hasSport: false, noSchool: false },
      ...c,
    })),
  };
}

describe('diffDigests', () => {
  it('ne signale rien sans digest précédent', () => {
    expect(diffDigests(undefined, digest([{ lessons: [lesson()] }]))).toEqual([]);
  });

  it('ne compare pas deux digests de dates différentes', () => {
    const previous = digest([{ lessons: [] }], '2026-09-04');
    const current = digest([{ lessons: [lesson()] }]);
    expect(diffDigests(previous, current)).toEqual([]);
  });

  it('signale un devoir ajouté dans le digest devoirs', () => {
    const previous = digest([{ homework: [] }], '2026-09-07', 'homework');
    const current = digest([{ homework: [homework()] }], '2026-09-07', 'homework');
    expect(diffDigests(previous, current)).toEqual([
      { child: 'Alice', type: 'homework-added', label: 'MATHEMATIQUES : signer la charte' },
    ]);
  });

  it('signale un cours annulé et un cours déplacé', () => {
    const previous = digest([{ lessons: [lesson(), lesson({ id: 'l2', subject: 'MATHS' })] }]);
    const current = digest([
      {
        lessons: [
          lesson({ status: 'cancelled' }),
          lesson({ id: 'l2', subject: 'MATHS', status: 'moved' }),
        ],
      },
    ]);
    expect(diffDigests(previous, current)).toEqual([
      { child: 'Alice', type: 'lesson-cancelled', label: 'FRANCAIS 08:00–08:55' },
      { child: 'Alice', type: 'lesson-moved', label: 'MATHS 08:00–08:55' },
    ]);
  });

  it('signale un cours ajouté et un cours retiré', () => {
    const previous = digest([{ lessons: [lesson()] }]);
    const current = digest([{ lessons: [lesson({ id: 'l9', subject: 'SVT' })] }]);
    expect(diffDigests(previous, current)).toEqual([
      { child: 'Alice', type: 'lesson-added', label: 'SVT 08:00–08:55' },
      { child: 'Alice', type: 'lesson-removed', label: 'FRANCAIS 08:00–08:55' },
    ]);
  });

  it('ne signale que les cours dans un planning, que les devoirs dans un digest devoirs', () => {
    const before = { lessons: [lesson()], homework: [] };
    const after = { lessons: [lesson({ status: 'cancelled' })], homework: [homework()] };
    expect(diffDigests(digest([before]), digest([after])).map((c) => c.type)).toEqual([
      'lesson-cancelled',
    ]);
    expect(
      diffDigests(
        digest([before], '2026-09-07', 'homework'),
        digest([after], '2026-09-07', 'homework'),
      ).map((c) => c.type),
    ).toEqual(['homework-added']);
  });

  it('ignore un enfant absent du digest précédent', () => {
    const previous = digest([{ name: 'Bob' }]);
    const current = digest([{ name: 'Alice', homework: [homework()] }]);
    expect(diffDigests(previous, current)).toEqual([]);
  });

  it('ne signale rien quand rien ne change', () => {
    const d = digest([{ lessons: [lesson()], homework: [homework()] }]);
    expect(diffDigests(d, d)).toEqual([]);
  });
});
