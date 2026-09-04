import { describe, expect, it } from 'vitest';
import { homeworkFor } from '../../src/core/homework.js';
import { parsePronoteIcs } from '../../src/sources/pronote/parse.js';
import { readFixture } from '../helpers/fixtures.js';
import { buildIcs, pronoteDescription } from '../helpers/ics.js';

const feed6e = parsePronoteIcs(readFixture('pronote-6e.ics'));
const feed4e = parsePronoteIcs(readFixture('pronote-4e.ics'));

describe('homeworkFor', () => {
  it('rassemble les devoirs dus un jour donné depuis les blocs « Donné le »', () => {
    const hw = homeworkFor(feed4e.lessons, '2026-09-11');
    expect(hw.map((h) => h.subject)).toEqual(['PHYSIQUE-CHIMIE', 'PHYSIQUE-CHIMIE']);
    expect(hw[0]).toMatchObject({
      assignedOn: '2026-09-04',
      dueOn: '2026-09-11',
      teachers: ['LAURENT J.'],
    });
  });

  it('dédoublonne un devoir répété sur plusieurs cours du même enseignant', () => {
    // Le 3 septembre, la prof de français a un cours, un cours annulé et une vie de classe :
    // Pronote y duplique les mêmes blocs « Donné le ».
    const hw = homeworkFor(feed6e.lessons, '2026-09-03');
    const texts = hw.map((h) => h.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(hw.every((h) => h.subject === 'FRANCAIS')).toBe(true);
  });

  it('inclut les devoirs portés par un cours annulé', () => {
    const hw = homeworkFor(feed6e.lessons, '2026-09-03');
    expect(hw.length).toBeGreaterThan(0);
  });

  it('renvoie une liste vide sans devoir', () => {
    expect(homeworkFor(feed4e.lessons, '2026-09-02')).toEqual([]);
  });

  it('retombe sur les blocs « Pour le » quand le flux ne fournit pas « Donné le »', () => {
    const ics = buildIcs([
      {
        uid: 'a',
        start: '20260903T060000Z',
        end: '20260903T065500Z',
        summary: 'MATHS - X',
        description: pronoteDescription({ Matière: 'MATHEMATIQUES', Professeur: 'BERNARD B.' }, [
          { label: 'Pour le 08/09/2026', html: '<div>signer la charte</div>' },
        ]),
      },
      {
        uid: 'b',
        start: '20260908T060000Z',
        end: '20260908T065500Z',
        summary: 'MATHS - X',
        description: pronoteDescription({ Matière: 'MATHEMATIQUES', Professeur: 'BERNARD B.' }),
      },
    ]);
    const hw = homeworkFor(parsePronoteIcs(ics).lessons, '2026-09-08');
    expect(hw).toHaveLength(1);
    expect(hw[0]).toMatchObject({
      assignedOn: '2026-09-03',
      dueOn: '2026-09-08',
      text: 'signer la charte',
    });
  });

  it('ne compte pas deux fois un devoir présent en « Pour le » et en « Donné le »', () => {
    const hw = homeworkFor(feed4e.lessons, '2026-09-08');
    expect(hw.map((h) => h.text)).toEqual(['signer la charte']);
  });

  it('produit des identifiants stables', () => {
    const a = homeworkFor(feed4e.lessons, '2026-09-08');
    const b = homeworkFor(feed4e.lessons, '2026-09-08');
    expect(a.map((h) => h.id)).toEqual(b.map((h) => h.id));
  });

  it('trie par matière puis par texte', () => {
    const hw = homeworkFor(feed6e.lessons, '2026-09-07');
    const keys = hw.map((h) => `${h.subject}|${h.text}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});
