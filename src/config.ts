import { z } from 'zod';
import { DigestKindSchema, IsoDateSchema } from './core/model.js';

const csv = (value: unknown) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : value;

const bool = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const lower = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(lower)) return false;
  return v;
}, z.boolean());

const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const ChildConfigSchema = z.object({
  name: z.string().min(1, 'le prénom est requis'),
  ics: z.string().url('l’URL du flux iCal est invalide'),
});

const ChildrenSchema = z.preprocess(
  (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  z.array(ChildConfigSchema).min(1, 'au moins un enfant est requis'),
);

const SmtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: bool.default(false),
  user: optionalString,
  pass: optionalString,
  from: z.string().min(1),
  to: z.preprocess(csv, z.array(z.string().email()).min(1)),
});
export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

const AiConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'mistral', 'google', 'ollama', 'openai-compatible']),
  model: z.string().min(1),
  apiKey: optionalString,
  baseUrl: optionalString,
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

const ConfigSchema = z.object({
  children: ChildrenSchema,
  kind: DigestKindSchema,
  channels: z.preprocess(csv, z.array(z.enum(['email', 'file'])).default(['email'])),
  subjectPrefix: z.string().default('[Pronote]'),
  /** Répertoire d'archive ; `none` pour désactiver (chaîne vide après analyse). */
  archiveDir: z
    .string()
    .default('archive')
    .transform((v) => (v.trim().toLowerCase() === 'none' ? '' : v)),
  onNoSchool: z.enum(['notify', 'skip']).default('notify'),
  requireHomeworkData: bool.default(true),
  /** Jour de préparation (AAAA-MM-JJ), par défaut aujourd'hui en heure de Paris. */
  date: z.preprocess((v) => (v === '' ? undefined : v), IsoDateSchema.optional()),
  dryRun: bool.default(false),
  fetchTimeoutMs: z.coerce.number().int().positive().default(20_000),
  smtp: SmtpConfigSchema.optional(),
  fileDir: z.string().default('out'),
  ai: AiConfigSchema.optional(),
  /** Digests pour lesquels une intro est demandée au fournisseur IA. */
  aiDigests: z.preprocess(csv, z.array(DigestKindSchema).default(['planning'])),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Variables lues, communes à la CLI (env) et à l'action (inputs). */
export type RawConfig = Partial<Record<RawKey, string | undefined>>;
export type RawKey =
  | 'CHILDREN'
  | 'DIGEST'
  | 'CHANNELS'
  | 'SUBJECT_PREFIX'
  | 'ARCHIVE_DIR'
  | 'ON_NO_SCHOOL'
  | 'REQUIRE_HOMEWORK_DATA'
  | 'DATE'
  | 'DRY_RUN'
  | 'FETCH_TIMEOUT_MS'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_SECURE'
  | 'SMTP_USER'
  | 'SMTP_PASS'
  | 'MAIL_FROM'
  | 'MAIL_TO'
  | 'FILE_DIR'
  | 'AI_PROVIDER'
  | 'AI_MODEL'
  | 'AI_API_KEY'
  | 'AI_BASE_URL'
  | 'AI_DIGESTS';

export const RAW_KEYS: RawKey[] = [
  'CHILDREN',
  'DIGEST',
  'CHANNELS',
  'SUBJECT_PREFIX',
  'ARCHIVE_DIR',
  'ON_NO_SCHOOL',
  'REQUIRE_HOMEWORK_DATA',
  'DATE',
  'DRY_RUN',
  'FETCH_TIMEOUT_MS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'MAIL_TO',
  'FILE_DIR',
  'AI_PROVIDER',
  'AI_MODEL',
  'AI_API_KEY',
  'AI_BASE_URL',
  'AI_DIGESTS',
];

function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
  ) as Partial<T>;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export function parseConfig(raw: RawConfig): Config {
  const smtpGiven = raw.SMTP_HOST !== undefined && raw.SMTP_HOST !== '';
  const aiGiven = raw.AI_PROVIDER !== undefined && raw.AI_PROVIDER !== '';
  const candidate = defined({
    children: raw.CHILDREN,
    kind: raw.DIGEST,
    channels: raw.CHANNELS,
    subjectPrefix: raw.SUBJECT_PREFIX,
    archiveDir: raw.ARCHIVE_DIR,
    onNoSchool: raw.ON_NO_SCHOOL,
    requireHomeworkData: raw.REQUIRE_HOMEWORK_DATA,
    date: raw.DATE,
    dryRun: raw.DRY_RUN,
    fetchTimeoutMs: raw.FETCH_TIMEOUT_MS,
    fileDir: raw.FILE_DIR,
    aiDigests: raw.AI_DIGESTS,
    smtp: smtpGiven
      ? defined({
          host: raw.SMTP_HOST,
          port: raw.SMTP_PORT,
          secure: raw.SMTP_SECURE,
          user: raw.SMTP_USER,
          pass: raw.SMTP_PASS,
          from: raw.MAIL_FROM,
          to: raw.MAIL_TO,
        })
      : undefined,
    ai: aiGiven
      ? defined({
          provider: raw.AI_PROVIDER,
          model: raw.AI_MODEL,
          apiKey: raw.AI_API_KEY,
          baseUrl: raw.AI_BASE_URL,
        })
      : undefined,
  });

  let result: ReturnType<typeof ConfigSchema.safeParse>;
  try {
    result = ConfigSchema.safeParse(candidate);
  } catch (error) {
    throw new ConfigError(`CHILDREN doit être un tableau JSON : ${String(error)}`);
  }
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`)
      .join(' ; ');
    throw new ConfigError(`Configuration invalide : ${details}`);
  }
  const config = result.data;
  if (config.channels.includes('email') && config.smtp === undefined && !config.dryRun) {
    throw new ConfigError('Le canal email exige SMTP_HOST, MAIL_FROM et MAIL_TO.');
  }
  return config;
}
