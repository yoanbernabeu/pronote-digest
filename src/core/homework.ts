import { createHash } from 'node:crypto';
import type { PronoteLesson } from '../sources/pronote/parse.js';
import type { Homework, IsoDate } from './model.js';

function stableId(parts: string[]): string {
  return createHash('sha1').update(parts.join(' ')).digest('hex').slice(0, 12);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Devoirs à rendre le jour `dueOn`.
 * Source principale : les blocs « Donné le » portés par les cours de ce jour.
 * Source de repli : les blocs « Pour le » de n'importe quel cours visant ce jour.
 * Les deux sont fusionnées et dédoublonnées sur (enseignants, texte) : Pronote recopie le même
 * bloc dans tous les cours de l'enseignant ce jour-là, y compris sous une autre matière (vie de
 * classe, accompagnement personnalisé), et la date « Donné le » (saisie) peut différer du jour du
 * cours porteur du « Pour le ». Les blocs « Donné le » sont traités en premier, puis le premier
 * cours maintenu dans l'ordre de la journée fixe la matière retenue.
 */
export function homeworkFor(lessons: PronoteLesson[], dueOn: IsoDate): Homework[] {
  const byKey = new Map<string, Homework>();

  const add = (lesson: PronoteLesson, assignedOn: IsoDate, html: string, text: string) => {
    const key = [lesson.teachers.join(','), normalize(text)].join('|');
    if (byKey.has(key)) return;
    byKey.set(key, {
      id: stableId([lesson.teachers.join(','), dueOn, normalize(text)]),
      subject: lesson.subject,
      teachers: lesson.teachers,
      assignedOn,
      dueOn,
      text,
      html,
    });
  };

  const ordered = [...lessons].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'scheduled' ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  for (const lesson of ordered) {
    if (!lesson.start.startsWith(dueOn)) continue;
    for (const block of lesson.homeworkBlocks) {
      if (block.kind === 'assigned') add(lesson, block.date, block.html, block.text);
    }
  }
  for (const lesson of ordered) {
    for (const block of lesson.homeworkBlocks) {
      if (block.kind === 'due' && block.date === dueOn) {
        add(lesson, lesson.start.slice(0, 10), block.html, block.text);
      }
    }
  }

  return [...byKey.values()].sort((a, b) =>
    a.subject === b.subject
      ? a.text.localeCompare(b.text, 'fr')
      : a.subject.localeCompare(b.subject, 'fr'),
  );
}
