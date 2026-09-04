import sanitizeHtml from 'sanitize-html';
import type { ChildDigest, Digest, Homework, Lesson } from '../core/model.js';
import { longDate, timeHM, timeRange } from '../core/time.js';

/** Modèle de présentation partagé par tous les formats : tout est déjà formaté en chaînes. */
interface LessonView {
  time: string;
  subject: string;
  teachers: string;
  rooms: string;
  status: Lesson['status'];
  statusLabel: string;
}

interface HomeworkView {
  subject: string;
  teachers: string;
  assignedOn: string;
  text: string;
  html: string;
}

interface ChildView {
  name: string;
  noSchool: boolean;
  holiday: string | undefined;
  hasSport: boolean;
  firstStart: string | undefined;
  lastEnd: string | undefined;
  lessons: LessonView[];
  homework: HomeworkView[];
}

export interface DigestView {
  kind: Digest['kind'];
  title: string;
  subject: string;
  targetDate: string;
  schoolDay: boolean;
  holiday: string | undefined;
  nextSchoolDay: string | undefined;
  intro: string | undefined;
  children: ChildView[];
  generatedAt: string;
}

export interface ViewOptions {
  subjectPrefix?: string;
}

const STATUS_LABEL: Record<Lesson['status'], string> = {
  scheduled: '',
  cancelled: 'Annulé',
  moved: 'Déplacé',
};

export function sanitizeTeacherHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'ul', 'ol', 'li', 'a', 'span'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

function lessonView(lesson: Lesson): LessonView {
  return {
    time: timeRange(lesson.start, lesson.end),
    subject: lesson.subject,
    teachers: lesson.teachers.join(', '),
    rooms: lesson.rooms.join(', '),
    status: lesson.status,
    statusLabel: STATUS_LABEL[lesson.status],
  };
}

function homeworkView(hw: Homework): HomeworkView {
  return {
    subject: hw.subject,
    teachers: hw.teachers.join(', '),
    assignedOn: longDate(hw.assignedOn),
    text: hw.text,
    html: sanitizeTeacherHtml(hw.html),
  };
}

function childView(child: ChildDigest): ChildView {
  return {
    name: child.name,
    noSchool: child.flags.noSchool,
    holiday: child.flags.holiday,
    hasSport: child.flags.hasSport,
    firstStart: child.flags.firstStart === undefined ? undefined : timeHM(child.flags.firstStart),
    lastEnd: child.flags.lastEnd === undefined ? undefined : timeHM(child.flags.lastEnd),
    lessons: child.lessons.map(lessonView),
    homework: child.homework.map(homeworkView),
  };
}

export function buildView(digest: Digest, options: ViewOptions = {}): DigestView {
  const date = longDate(digest.targetDate);
  const title = digest.kind === 'planning' ? `Planning du ${date}` : `Devoirs pour le ${date}`;
  const prefix = options.subjectPrefix === undefined ? '' : `${options.subjectPrefix} `;
  return {
    kind: digest.kind,
    title,
    subject: `${prefix}${title}`,
    targetDate: date,
    schoolDay: digest.schoolDay,
    holiday: digest.holiday,
    nextSchoolDay: digest.nextSchoolDay === undefined ? undefined : longDate(digest.nextSchoolDay),
    intro: digest.intro,
    children: digest.children.map(childView),
    generatedAt: digest.generatedAt,
  };
}
