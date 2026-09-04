import type { Digest } from '../core/model.js';
import { buildView, type ViewOptions } from './view.js';

export interface MarkdownRendering {
  subject: string;
  markdown: string;
}

/**
 * Rendu Markdown, construit en code plutôt qu'en gabarit : le Markdown est sensible aux fins de
 * ligne, et un gabarit textuel rend les blancs difficiles à maîtriser.
 */
export function renderMarkdown(digest: Digest, options: ViewOptions = {}): MarkdownRendering {
  const view = buildView(digest, options);
  const out: string[] = [`# ${view.title}`, ''];

  if (view.intro !== undefined) out.push(`_${view.intro}_`, '');

  if (!view.schoolDay) {
    const parts = [`**Pas de cours le ${view.targetDate}.**`];
    if (view.holiday !== undefined) parts.push(`${view.holiday}.`);
    if (view.nextSchoolDay !== undefined) parts.push(`Reprise le ${view.nextSchoolDay}.`);
    out.push(parts.join(' '), '');
  }

  for (const child of view.children) {
    out.push(`## ${child.name}`, '');
    if (child.changes.length > 0) {
      out.push('**Nouveautés**', ...child.changes.map((c) => `- ${c}`), '');
    }
    if (view.kind === 'planning') {
      if (child.noSchool) {
        out.push(`Pas de cours${child.holiday === undefined ? '' : ` (${child.holiday})`}.`, '');
      } else {
        const day = `Journée ${child.firstStart} – ${child.lastEnd}`;
        out.push(child.hasSport ? `${day} · EPS : tenue de sport` : day, '');
        for (const lesson of child.lessons) {
          const status = lesson.statusLabel === '' ? '' : ` (${lesson.statusLabel})`;
          const rooms = lesson.rooms === '' ? '' : ` · ${lesson.rooms}`;
          out.push(`- ${lesson.time} ${lesson.subject}${status}${rooms}`);
        }
        out.push('');
      }
    } else if (child.homework.length === 0) {
      out.push('Aucun devoir saisi pour ce jour.', '');
    } else {
      for (const hw of child.homework) {
        out.push(`- **${hw.subject}** (${hw.teachers}) : ${hw.text}`);
      }
      out.push('');
    }
  }

  return { subject: view.subject, markdown: `${out.join('\n').trimEnd()}\n` };
}
