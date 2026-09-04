import { describe, expect, it } from 'vitest';
import { parsePronoteIcs } from '../../src/sources/pronote/parse.js';
import { readFixture } from '../helpers/fixtures.js';
import { buildIcs, pronoteDescription } from '../helpers/ics.js';

const feed4e = parsePronoteIcs(readFixture('pronote-4e.ics'));
const feed6e = parsePronoteIcs(readFixture('pronote-6e.ics'));

describe('parsePronoteIcs – en-tête', () => {
  it('lit le nom du calendrier', () => {
    expect(feed4e.calendarName).toContain('DUPONT Alice');
  });

  it('refuse un contenu qui n’est pas un calendrier', () => {
    expect(() => parsePronoteIcs('bonjour')).toThrow(/VCALENDAR/);
  });

  it('refuse un calendrier sans aucun événement', () => {
    expect(() => parsePronoteIcs('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')).toThrow(
      /aucun événement/i,
    );
  });
});

describe('parsePronoteIcs – cours', () => {
  it('sépare les cours des jours fériés et vacances', () => {
    expect(feed4e.lessons).toHaveLength(158);
    expect(feed4e.events).toHaveLength(9);
  });

  it('convertit les horaires en heure de Paris avec décalage explicite', () => {
    const music = feed4e.lessons.find(
      (l) => l.id === 'Cours-16027-1-20260904T120218Z-Index-Education',
    );
    expect(music?.start).toBe('2026-09-03T14:55:00+02:00');
    expect(music?.end).toBe('2026-09-03T15:50:00+02:00');
  });

  it('lit matière, professeur et salle depuis la description structurée', () => {
    const music = feed4e.lessons.find(
      (l) => l.id === 'Cours-16027-1-20260904T120218Z-Index-Education',
    );
    expect(music?.subject).toBe('EDUCATION MUSICALE');
    expect(music?.teachers).toEqual(['DURAND G.']);
    expect(music?.rooms).toEqual(['S002 Education musicale']);
    expect(music?.status).toBe('scheduled');
  });

  it('gère plusieurs professeurs et plusieurs salles', () => {
    const tp = feed6e.lessons.find((l) => l.subject === 'TRAVAIL PERSONNEL');
    expect(tp?.teachers).toEqual(['LEROY N.', 'MOREL R.']);
    expect(tp?.rooms).toEqual(['S106', 'S113']);
  });

  it('lit le groupe sans le confondre avec la salle', () => {
    const ap = feed6e.lessons.find((l) => l.group !== undefined);
    expect(ap?.group).toBe('[6E5 AP MATHS GR1]');
    expect(ap?.rooms).toEqual(['S110']);
  });

  it('tolère un cours sans salle', () => {
    const eps = feed4e.lessons.find((l) => l.subject === 'ED.PHYSIQUE & SPORT.');
    expect(eps?.rooms).toEqual([]);
  });

  it('marque les cours annulés et déplacés', () => {
    const cancelled = feed6e.lessons.filter((l) => l.status === 'cancelled');
    const moved = feed6e.lessons.filter((l) => l.status === 'moved');
    expect(cancelled.map((l) => l.subject).sort()).toEqual(['FRANCAIS', 'VIE DE CLASSE']);
    expect(moved).toHaveLength(1);
    expect(moved[0]?.start).toBe('2026-09-10T16:05:00+02:00');
  });
});

describe('parsePronoteIcs – cahier de textes', () => {
  it('extrait le contenu pédagogique en texte brut', () => {
    const music = feed4e.lessons.find(
      (l) => l.id === 'Cours-16027-1-20260904T120218Z-Index-Education',
    );
    expect(music?.content).toBe('écoute comparée découverte');
  });

  it('extrait les blocs « Pour le » avec leur date d’échéance', () => {
    const music = feed4e.lessons.find(
      (l) => l.id === 'Cours-16027-1-20260904T120218Z-Index-Education',
    );
    expect(music?.homeworkBlocks).toHaveLength(1);
    expect(music?.homeworkBlocks[0]).toMatchObject({ kind: 'due', date: '2026-09-10' });
    expect(music?.homeworkBlocks[0]?.text).toContain('work-song');
  });

  it('extrait les blocs « Donné le » avec leur date d’origine', () => {
    const target = feed4e.lessons.find(
      (l) => l.start.startsWith('2026-09-10') && l.subject === 'EDUCATION MUSICALE',
    );
    expect(target?.homeworkBlocks).toHaveLength(1);
    expect(target?.homeworkBlocks[0]).toMatchObject({ kind: 'assigned', date: '2026-09-03' });
  });

  it('extrait plusieurs blocs sur un même cours', () => {
    const physics = feed4e.lessons.find(
      (l) => l.start.startsWith('2026-09-04') && l.subject === 'PHYSIQUE-CHIMIE',
    );
    expect(physics?.homeworkBlocks.map((b) => b.kind)).toEqual(['due', 'due']);
  });

  it('ne confond pas le gras des enseignants avec les libellés Pronote', () => {
    const ics = buildIcs([
      {
        uid: 'x',
        start: '20260903T125500Z',
        end: '20260903T135000Z',
        summary: 'ESPAGNOL LV2 - ROBERT E.',
        description: pronoteDescription({ Matière: 'ESPAGNOL LV2', Professeur: 'ROBERT E.' }, [
          { label: 'Contenu pédagogique', html: '<p><strong>Séquence</strong> : présentation</p>' },
          {
            label: 'Pour le 10/09/2026',
            html: '<div><strong>Apprendre</strong> le vocabulaire</div>',
          },
        ]),
      },
    ]);
    const lesson = parsePronoteIcs(ics).lessons[0];
    expect(lesson?.content).toBe('Séquence : présentation');
    expect(lesson?.homeworkBlocks).toHaveLength(1);
    expect(lesson?.homeworkBlocks[0]?.text).toBe('Apprendre le vocabulaire');
  });

  it('décode les entités HTML des en-têtes', () => {
    const eps = feed4e.lessons.find((l) => l.subject === 'ED.PHYSIQUE & SPORT.');
    expect(eps).toBeDefined();
    const ap = feed6e.lessons.find((l) => l.group === '[6E5 AP MATHS GR1]');
    expect(ap?.group).toBe('[6E5 AP MATHS GR1]');
  });

  it('signale la présence de données de cahier de textes', () => {
    expect(feed4e.hasHomeworkData).toBe(true);
  });

  it('signale l’absence de cahier de textes sur un flux sans ces blocs', () => {
    const stripped = readFixture('pronote-4e.ics').replace(
      /<strong>(Pour le|Donné le|Contenu pédagogique)[\s\S]*?(?=\r\n(?:X-ALT-DESC|COLOR))/g,
      '',
    );
    expect(parsePronoteIcs(stripped).hasHomeworkData).toBe(false);
  });
});

describe('parsePronoteIcs – vacances et fériés', () => {
  it('lit une période de vacances avec fin exclusive', () => {
    const toussaint = feed4e.events.find((e) => e.from === '2026-10-18');
    expect(toussaint).toEqual({
      kind: 'holiday',
      label: 'Vacances',
      from: '2026-10-18',
      to: '2026-11-02',
    });
  });

  it('lit un jour férié', () => {
    const armistice = feed4e.events.find((e) => e.from === '2026-11-11');
    expect(armistice).toEqual({
      kind: 'public-holiday',
      label: 'Férié',
      from: '2026-11-11',
      to: '2026-11-12',
    });
  });
});
