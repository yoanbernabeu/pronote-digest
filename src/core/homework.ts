import { createHash } from 'node:crypto';
import type { PronoteLesson } from '../sources/pronote/parse.js';
import type { Homework, IsoDate } from './model.js';

function stableId(parts: string[]): string {
  return createHash('sha1').update(parts.join(' ')).digest('hex').slice(0, 12);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Cours maintenus d'abord, puis ceux qui ont le moins d'enseignants (la matière « pure »), puis l'heure. */
function byPriority(a: PronoteLesson, b: PronoteLesson): number {
  if (a.status !== b.status) return a.status === 'scheduled' ? -1 : 1;
  if (a.teachers.length !== b.teachers.length) return a.teachers.length - b.teachers.length;
  return a.start.localeCompare(b.start);
}

/**
 * Devoirs à rendre le jour `dueOn`.
 *
 * Pronote recopie le même bloc dans tous les cours de l'enseignant le jour de l'échéance, y compris
 * sous une autre matière (vie de classe, accompagnement personnalisé, EMC pour un prof d'histoire),
 * et parfois avec un co-enseignant. On dédoublonne donc sur le texte seul.
 *
 * Passe 1 : les blocs « Pour le » visant `dueOn`, portés par le cours où le devoir a été donné. Ils
 * donnent la matière d'origine et la date du cours. Passe 2 : les blocs « Donné le » des cours du jour,
 * pour les flux qui n'émettent pas « Pour le ».
 */
export function homeworkFor(lessons: PronoteLesson[], dueOn: IsoDate): Homework[] {
  const byText = new Map<string, Homework>();
  const ordered = [...lessons].sort(byPriority);

  const add = (lesson: PronoteLesson, assignedOn: IsoDate, html: string, text: string) => {
    const key = normalize(text);
    if (byText.has(key)) return;
    byText.set(key, {
      id: stableId([dueOn, key]),
      subject: lesson.subject,
      teachers: lesson.teachers,
      assignedOn,
      dueOn,
      text,
      html,
    });
  };

  for (const lesson of ordered) {
    for (const block of lesson.homeworkBlocks) {
      if (block.kind === 'due' && block.date === dueOn) {
        add(lesson, lesson.start.slice(0, 10), block.html, block.text);
      }
    }
  }
  for (const lesson of ordered) {
    if (!lesson.start.startsWith(dueOn)) continue;
    for (const block of lesson.homeworkBlocks) {
      if (block.kind === 'assigned') add(lesson, block.date, block.html, block.text);
    }
  }

  return [...byText.values()].sort((a, b) =>
    a.subject === b.subject
      ? a.text.localeCompare(b.text, 'fr')
      : a.subject.localeCompare(b.subject, 'fr'),
  );
}
