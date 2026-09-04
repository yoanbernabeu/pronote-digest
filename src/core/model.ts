import { z } from 'zod';

/** Date calendaire locale, sans heure : AAAA-MM-JJ. */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'AAAA-MM-JJ attendu');
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Instant avec décalage explicite, ISO 8601. */
const IsoDateTimeSchema = z.string().datetime({ offset: true });

const LessonStatusSchema = z.enum(['scheduled', 'cancelled', 'moved']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const LessonSchema = z
  .object({
    id: z.string().min(1),
    start: IsoDateTimeSchema,
    end: IsoDateTimeSchema,
    subject: z.string().min(1),
    teachers: z.array(z.string()),
    rooms: z.array(z.string()),
    status: LessonStatusSchema,
    /** Contenu pédagogique saisi par l'enseignant, texte brut. */
    content: z.string().optional(),
  })
  .refine((l) => Date.parse(l.end) > Date.parse(l.start), {
    message: 'la fin doit être après le début',
    path: ['end'],
  });
export type Lesson = z.infer<typeof LessonSchema>;

export const HomeworkSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  teachers: z.array(z.string()),
  assignedOn: IsoDateSchema,
  dueOn: IsoDateSchema,
  text: z.string(),
  html: z.string(),
});
export type Homework = z.infer<typeof HomeworkSchema>;

export const SchoolEventSchema = z.object({
  kind: z.enum(['holiday', 'public-holiday']),
  label: z.string(),
  from: IsoDateSchema,
  /** Borne de fin exclusive, comme dans iCalendar. */
  to: IsoDateSchema,
});
export type SchoolEvent = z.infer<typeof SchoolEventSchema>;

export const ChildDigestSchema = z.object({
  name: z.string().min(1),
  lessons: z.array(LessonSchema),
  homework: z.array(HomeworkSchema),
  flags: z.object({
    hasSport: z.boolean(),
    noSchool: z.boolean(),
    holiday: z.string().optional(),
    firstStart: IsoDateTimeSchema.optional(),
    lastEnd: IsoDateTimeSchema.optional(),
  }),
});
export type ChildDigest = z.infer<typeof ChildDigestSchema>;

const ChangeSchema = z.object({
  child: z.string(),
  type: z.enum([
    'homework-added',
    'lesson-cancelled',
    'lesson-moved',
    'lesson-added',
    'lesson-removed',
  ]),
  label: z.string(),
});
export type Change = z.infer<typeof ChangeSchema>;

export const DigestKindSchema = z.enum(['planning', 'homework']);
export type DigestKind = z.infer<typeof DigestKindSchema>;

export const DigestSchema = z.object({
  version: z.literal(1),
  generatedAt: IsoDateTimeSchema,
  targetDate: IsoDateSchema,
  kind: DigestKindSchema,
  /** Faux quand le jour visé n'a aucun cours (week-end, vacances, férié). */
  schoolDay: z.boolean(),
  holiday: z.string().optional(),
  nextSchoolDay: IsoDateSchema.optional(),
  children: z.array(ChildDigestSchema),
  changes: z.array(ChangeSchema),
  intro: z.string().optional(),
});
export type Digest = z.infer<typeof DigestSchema>;
