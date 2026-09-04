import { generateText, type LanguageModel } from 'ai';
import type { AiConfig } from '../config.js';
import type { Digest } from '../core/model.js';
import { timeHM } from '../core/time.js';
import { buildView } from '../formatters/view.js';
import type { IntroProvider } from './types.js';

export type GenerateFn = (args: {
  model: LanguageModel;
  system: string;
  prompt: string;
}) => Promise<{
  text: string;
}>;

export interface AiIntroOptions {
  /** Injectable pour les tests. */
  generate?: GenerateFn;
  resolveModel?: (config: AiConfig) => Promise<LanguageModel>;
  timeoutMs?: number;
}

const SYSTEM = `Tu rédiges, pour des parents, l'introduction d'un message quotidien sur la journée scolaire de leurs enfants.
Règles :
- Trois à cinq phrases en français, ton chaleureux et sobre, sans emoji, sans titre, sans liste.
- Appuie-toi uniquement sur les données fournies. N'invente aucun horaire, aucune matière, aucun devoir.
- Ne cite pas d'horaire précis : le message détaille déjà les heures. Dis plutôt « finit tôt », « journée longue ».
- Mets en avant ce qui aide à s'organiser : sac de sport, devoirs à rendre, cours annulé, journée sans cours, nouveautés.
- Réponds par le texte seul.`;

async function defaultResolveModel(config: AiConfig): Promise<LanguageModel> {
  switch (config.provider) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic(settings(config))(config.model);
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI(settings(config))(config.model);
    }
    case 'mistral': {
      const { createMistral } = await import('@ai-sdk/mistral');
      return createMistral(settings(config))(config.model);
    }
    case 'google': {
      const { createGoogle } = await import('@ai-sdk/google');
      return createGoogle(settings(config))(config.model);
    }
    case 'ollama':
    case 'openai-compatible': {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
      const baseURL =
        config.baseUrl ?? (config.provider === 'ollama' ? 'http://localhost:11434/v1' : undefined);
      if (baseURL === undefined) throw new Error('AI_BASE_URL est requis pour openai-compatible.');
      return createOpenAICompatible({
        name: config.provider,
        baseURL,
        ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }),
      })(config.model);
    }
  }
}

function settings(config: AiConfig): { apiKey?: string; baseURL?: string } {
  return {
    ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }),
    ...(config.baseUrl === undefined ? {} : { baseURL: config.baseUrl }),
  };
}

/** Données transmises au modèle : le modèle de présentation, sans HTML. */
export function describeDigest(digest: Digest): string {
  const view = buildView(digest);
  const lines: string[] = [`Type : ${digest.kind === 'planning' ? 'planning' : 'devoirs'}`];
  lines.push(`Jour visé : ${view.targetDate}${view.schoolDay ? '' : ' (pas de cours)'}`);
  if (view.holiday !== undefined) lines.push(`Période : ${view.holiday}`);
  if (view.nextSchoolDay !== undefined) lines.push(`Reprise : ${view.nextSchoolDay}`);
  for (const child of view.children) {
    lines.push('', `Enfant : ${child.name}`);
    if (child.noSchool) lines.push('Pas de cours.');
    else {
      lines.push(
        `Journée de ${child.firstStart} à ${child.lastEnd}${child.hasSport ? ', avec EPS' : ''}`,
      );
      for (const l of child.lessons) {
        lines.push(`- ${l.time} ${l.subject}${l.statusLabel ? ` (${l.statusLabel})` : ''}`);
      }
    }
    if (child.homework.length > 0) {
      lines.push('Devoirs :');
      for (const h of child.homework) lines.push(`- ${h.subject} : ${h.text}`);
    }
    if (child.changes.length > 0) {
      lines.push('Nouveautés :');
      for (const c of child.changes) lines.push(`- ${c}`);
    }
  }
  return lines.join('\n');
}

const TIME_PATTERN = /\b([01]?\d|2[0-3])\s*[h:]\s*([0-5]\d)?\b/g;

/** Toute heure citée par le modèle doit exister dans les données, sinon l'intro est rejetée. */
export function mentionsUnknownTime(text: string, digest: Digest): boolean {
  const known = new Set<string>();
  for (const child of digest.children) {
    for (const lesson of child.lessons) {
      known.add(timeHM(lesson.start));
      known.add(timeHM(lesson.end));
    }
  }
  for (const match of text.matchAll(TIME_PATTERN)) {
    const hour = match[1]?.padStart(2, '0');
    const minutes = match[2] ?? '00';
    if (hour === undefined) continue;
    if (!known.has(`${hour}:${minutes}`)) return true;
  }
  return false;
}

export class AiIntroProvider implements IntroProvider {
  private readonly generateFn: GenerateFn;
  private readonly resolveModel: (config: AiConfig) => Promise<LanguageModel>;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: AiConfig,
    options: AiIntroOptions = {},
  ) {
    this.generateFn = options.generate ?? (generateText as unknown as GenerateFn);
    this.resolveModel = options.resolveModel ?? defaultResolveModel;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async generate(digest: Digest): Promise<string | undefined> {
    const model = await this.resolveModel(this.config);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`délai IA dépassé (${this.timeoutMs} ms)`)),
        this.timeoutMs,
      ).unref(),
    );
    const { text } = await Promise.race([
      this.generateFn({ model, system: SYSTEM, prompt: describeDigest(digest) }),
      timeout,
    ]);
    const intro = text.trim().replace(/\s+/g, ' ');
    if (intro.length === 0 || intro.length > 800) return undefined;
    if (mentionsUnknownTime(intro, digest)) return undefined;
    return intro;
  }
}
