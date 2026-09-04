import { describe, expect, it } from 'vitest';
import { buildDigest } from '../../src/core/digest.js';
import type { Digest } from '../../src/core/model.js';
import { renderEmail, renderMarkdown } from '../../src/formatters/index.js';
import { sanitizeTeacherHtml } from '../../src/formatters/view.js';
import { parsePronoteIcs } from '../../src/sources/pronote/parse.js';
import { readFixture } from '../helpers/fixtures.js';

const alice = { name: 'Alice', feed: parsePronoteIcs(readFixture('pronote-4e.ics')) };
const bob = { name: 'Bob', feed: parsePronoteIcs(readFixture('pronote-6e.ics')) };
const generatedAt = '2026-09-06T17:00:00.000Z';

function planning(today = '2026-09-06'): Digest {
  return buildDigest({ kind: 'planning', today, generatedAt, children: [alice, bob] }).digest;
}

function homework(today = '2026-09-07'): Digest {
  return buildDigest({ kind: 'homework', today, generatedAt, children: [alice, bob] }).digest;
}

describe('renderEmail – planning', () => {
  it('produit un sujet, un HTML complet et une version texte', async () => {
    const mail = await renderEmail(planning(), { subjectPrefix: '[Pronote]' });
    expect(mail.subject).toBe('[Pronote] Planning du lundi 7 septembre 2026');
    expect(mail.html).toContain('<!doctype html>');
    expect(mail.html).toContain('Alice');
    expect(mail.html).toContain('Bob');
    expect(mail.text).toContain('Planning du lundi 7 septembre 2026');
    expect(mail.text.split('Planning du lundi 7 septembre 2026')).toHaveLength(2);
    expect(mail.text).toContain('ACC. PERSO. FRANCAIS');
  });

  it('affiche les horaires, les salles et le badge EPS', async () => {
    const mail = await renderEmail(planning());
    expect(mail.html).toContain('08:00–08:55');
    expect(mail.html).toContain('S109');
    expect(mail.html).toContain('EPS : tenue de sport');
    expect(mail.html).toContain('Journée 08:00 – 17:00');
  });

  it('marque les cours annulés', async () => {
    const mail = await renderEmail(planning('2026-09-02'));
    expect(mail.html).toContain('(Annulé)');
    expect(mail.html).toContain('lesson-cancelled');
  });

  it('rend un mail court quand il n’y a pas cours', async () => {
    const mail = await renderEmail(planning('2026-09-12'));
    expect(mail.html).toContain('Pas de cours le dimanche 13 septembre 2026');
    expect(mail.html).toContain('Reprise le lundi 14 septembre 2026');
    expect(mail.html).not.toContain('<th>Heure</th>');
  });

  it('affiche l’intro quand elle existe', async () => {
    const digest = planning();
    digest.intro = 'Journée chargée pour Alice.';
    const mail = await renderEmail(digest);
    expect(mail.html).toContain('Journée chargée pour Alice.');
  });

  it('échappe le HTML venant des données', async () => {
    const digest = planning();
    const child = digest.children[0];
    if (child?.lessons[0] !== undefined) child.lessons[0].subject = '<script>alert(1)</script>';
    const mail = await renderEmail(digest);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('renderEmail – devoirs', () => {
  it('liste les devoirs avec leur HTML assaini', async () => {
    const mail = await renderEmail(homework());
    expect(mail.subject).toBe('Devoirs pour le mardi 8 septembre 2026');
    expect(mail.html).toContain('MATHEMATIQUES');
    expect(mail.html).toContain('signer la charte');
    expect(mail.html).toContain('donné le jeudi 3 septembre 2026');
  });

  it('indique l’absence de devoir', async () => {
    const mail = await renderEmail(homework('2026-09-01'));
    expect(mail.html).toContain('Aucun devoir saisi pour ce jour.');
  });
});

describe('renderMarkdown', () => {
  it('produit un planning en Markdown', () => {
    const md = renderMarkdown(planning(), { subjectPrefix: '[Pronote]' });
    expect(md.subject).toBe('[Pronote] Planning du lundi 7 septembre 2026');
    expect(md.markdown).toContain('# Planning du lundi 7 septembre 2026');
    expect(md.markdown).toContain('## Alice');
    expect(md.markdown).toContain('- 08:00–08:55 ACC. PERSO. FRANCAIS · S109');
    expect(md.markdown).toContain('EPS : tenue de sport');
  });

  it('n’échappe pas les entités HTML et garde les listes compactes', () => {
    const md = renderMarkdown(planning());
    expect(md.markdown).toContain('ED.PHYSIQUE & SPORT.');
    expect(md.markdown).not.toContain('&amp;');
    expect(md.markdown).toContain(
      '- 08:00–08:55 ACC. PERSO. FRANCAIS · S109\n- 08:55–09:50 FRANCAIS · S109',
    );
  });

  it('produit des devoirs en Markdown', () => {
    const md = renderMarkdown(homework());
    expect(md.markdown).toContain('- **MATHEMATIQUES** (BERNARD B.) : signer la charte');
  });

  it('gère les jours sans cours', () => {
    const md = renderMarkdown(planning('2026-09-12'));
    expect(md.markdown).toContain(
      '**Pas de cours le dimanche 13 septembre 2026.** Reprise le lundi 14 septembre 2026.',
    );
  });
});

describe('sanitizeTeacherHtml', () => {
  it('retire scripts, styles et attributs, garde la mise en forme', () => {
    const dirty =
      '<div style="color:red" onclick="x()"><strong>Lire</strong> p. 12 <script>alert(1)</script><a href="javascript:x()">lien</a><a href="https://ex.fr">ok</a></div>';
    expect(sanitizeTeacherHtml(dirty)).toBe(
      '<div><strong>Lire</strong> p. 12 <a>lien</a><a href="https://ex.fr">ok</a></div>',
    );
  });
});
