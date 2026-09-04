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

  it('fusionne un même devoir recopié dans un cours d’accompagnement du même enseignant', () => {
    // Le 7 septembre, « apporter le manuel » est recopié dans ACC. PERSO. FRANCAIS (deux enseignants)
    // et dans FRANCAIS (un enseignant) : on garde la matière d'origine, FRANCAIS.
    const hw = homeworkFor(feed4e.lessons, '2026-09-07');
    expect(hw.map((h) => `${h.subject}|${h.text.slice(0, 20)}`)).toEqual([
      'ANGLAIS LV1|lesson + vocabulary ',
      'FRANCAIS|Apporter le manuel d',
    ]);
  });

  it('rattache le devoir à la matière du cours où il a été donné, pas à un autre cours du prof', () => {
    // Donné en HISTOIRE-GEOGRAPHIE le 4/09 ; le 7/09 le même prof a EMC à 8h55 et HG à 14h.
    const hw = homeworkFor(feed6e.lessons, '2026-09-07');
    const illustrer = hw.filter((h) => h.text.startsWith('Illustrer'));
    expect(illustrer).toHaveLength(1);
    expect(illustrer[0]?.subject).toBe('HISTOIRE-GEOGRAPHIE');
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
