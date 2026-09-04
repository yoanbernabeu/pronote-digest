import type { Change, ChildDigest, Digest, Lesson } from './model.js';
import { timeRange } from './time.js';

function lessonLabel(lesson: Lesson): string {
  return `${lesson.subject} ${timeRange(lesson.start, lesson.end)}`;
}

function diffChild(previous: ChildDigest, current: ChildDigest): Change[] {
  const changes: Change[] = [];
  const child = current.name;

  const knownHomework = new Set(previous.homework.map((h) => h.id));
  for (const hw of current.homework) {
    if (!knownHomework.has(hw.id)) {
      changes.push({ child, type: 'homework-added', label: `${hw.subject} : ${hw.text}` });
    }
  }

  const previousLessons = new Map(previous.lessons.map((l) => [l.id, l]));
  const currentIds = new Set(current.lessons.map((l) => l.id));
  for (const lesson of current.lessons) {
    const before = previousLessons.get(lesson.id);
    if (before === undefined) {
      changes.push({ child, type: 'lesson-added', label: lessonLabel(lesson) });
      continue;
    }
    if (before.status !== 'cancelled' && lesson.status === 'cancelled') {
      changes.push({ child, type: 'lesson-cancelled', label: lessonLabel(lesson) });
    } else if (before.status !== 'moved' && lesson.status === 'moved') {
      changes.push({ child, type: 'lesson-moved', label: lessonLabel(lesson) });
    }
  }
  for (const lesson of previous.lessons) {
    if (!currentIds.has(lesson.id)) {
      changes.push({ child, type: 'lesson-removed', label: lessonLabel(lesson) });
    }
  }
  return changes;
}

/** Nouveautés du digest courant par rapport au précédent, pour la même date visée. */
export function diffDigests(previous: Digest | undefined, current: Digest): Change[] {
  if (previous === undefined || previous.targetDate !== current.targetDate) return [];
  const previousChildren = new Map(previous.children.map((c) => [c.name, c]));
  return current.children.flatMap((child) => {
    const before = previousChildren.get(child.name);
    return before === undefined ? [] : diffChild(before, child);
  });
}
