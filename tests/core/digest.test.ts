import { describe, expect, it } from 'vitest';
import { buildDigest } from '../../src/core/digest.js';
import { DigestSchema } from '../../src/core/model.js';
import { parsePronoteIcs } from '../../src/sources/pronote/parse.js';
import { readFixture } from '../helpers/fixtures.js';

const alice = { name: 'Alice', feed: parsePronoteIcs(readFixture('pronote-4e.ics')) };
const bob = { name: 'Bob', feed: parsePronoteIcs(readFixture('pronote-6e.ics')) };
const generatedAt = '2026-09-06T17:00:00.000Z';

describe('buildDigest', () => {
  it('produit un digest valide pour le lendemain', () => {
    const { digest, target } = buildDigest({
      kind: 'planning',
      today: '2026-09-06',
      generatedAt,
      children: [alice, bob],
    });
    expect(target).toEqual({ kind: 'school-day', date: '2026-09-07' });
    expect(DigestSchema.parse(digest)).toEqual(digest);
    expect(digest.targetDate).toBe('2026-09-07');
    expect(digest.children.map((c) => c.name)).toEqual(['Alice', 'Bob']);
  });

  it('liste les cours du jour visé, triés par heure', () => {
    const { digest } = buildDigest({
      kind: 'planning',
      today: '2026-09-06',
      generatedAt,
      children: [alice],
    });
    const lessons = digest.children[0]?.lessons ?? [];
    expect(lessons).toHaveLength(6);
    expect(lessons[0]).toMatchObject({
      subject: 'ACC. PERSO. FRANCAIS',
      start: '2026-09-07T08:00:00+02:00',
    });
    expect(lessons.map((l) => l.start)).toEqual([...lessons.map((l) => l.start)].sort());
  });

  it('calcule les indicateurs de la journée', () => {
    const { digest } = buildDigest({
      kind: 'planning',
      today: '2026-09-06',
      generatedAt,
      children: [alice],
    });
    expect(digest.children[0]?.flags).toEqual({
      hasSport: true,
      noSchool: false,
      firstStart: '2026-09-07T08:00:00+02:00',
      lastEnd: '2026-09-07T17:00:00+02:00',
    });
  });

  it('ignore les cours annulés pour la fin de journée', () => {
    const { digest } = buildDigest({
      kind: 'planning',
      today: '2026-09-02',
      generatedAt,
      children: [bob],
    });
    const child = digest.children[0];
    expect(child?.lessons.filter((l) => l.status === 'cancelled')).toHaveLength(2);
    expect(child?.flags.lastEnd).toBe('2026-09-03T14:55:00+02:00');
  });

  it('joint les devoirs du jour visé', () => {
    const { digest } = buildDigest({
      kind: 'homework',
      today: '2026-09-07',
      generatedAt,
      children: [alice],
    });
    expect(digest.children[0]?.homework.map((h) => h.text)).toEqual(['signer la charte']);
  });

  it('marque un enfant sans cours ce jour-là', () => {
    const { digest } = buildDigest({
      kind: 'planning',
      today: '2026-09-11',
      generatedAt,
      children: [alice],
    });
    expect(digest.targetDate).toBe('2026-09-14');
    expect(digest.children[0]?.flags.noSchool).toBe(false);
    const saturday = buildDigest({
      kind: 'planning',
      today: '2026-09-12',
      generatedAt,
      children: [alice],
    });
    expect(saturday.target.kind).toBe('no-school');
    expect(saturday.digest.children[0]?.flags).toEqual({ hasSport: false, noSchool: true });
  });

  it('signale les vacances', () => {
    const { digest, target } = buildDigest({
      kind: 'planning',
      today: '2026-10-20',
      generatedAt,
      children: [alice],
    });
    expect(target).toMatchObject({ kind: 'no-school', holiday: 'Vacances' });
    expect(digest.children[0]?.flags.holiday).toBe('Vacances');
    expect(digest).toMatchObject({ schoolDay: false, holiday: 'Vacances' });
  });

  it('ne conserve pas les blocs bruts dans les cours du digest', () => {
    const { digest } = buildDigest({
      kind: 'planning',
      today: '2026-09-06',
      generatedAt,
      children: [alice],
    });
    const lesson = digest.children[0]?.lessons[0] as Record<string, unknown>;
    expect(lesson).not.toHaveProperty('homeworkBlocks');
  });
});
