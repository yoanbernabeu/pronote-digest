import type { LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';
import type { AiConfig } from '../../src/config.js';
import { buildDigest } from '../../src/core/digest.js';
import type { Digest } from '../../src/core/model.js';
import { AiIntroProvider, describeDigest, mentionsUnknownTime } from '../../src/intro/ai.js';
import { createIntroProvider } from '../../src/intro/index.js';
import { parsePronoteIcs } from '../../src/sources/pronote/parse.js';
import { readFixture } from '../helpers/fixtures.js';

const alice = { name: 'Alice', feed: parsePronoteIcs(readFixture('pronote-4e.ics')) };
const digest: Digest = buildDigest({
  kind: 'planning',
  today: '2026-09-06',
  generatedAt: '2026-09-06T17:00:00.000Z',
  children: [alice],
}).digest;

const config: AiConfig = { provider: 'anthropic', model: 'claude-opus-5', apiKey: 'k' };
const fakeModel = { modelId: 'fake' } as unknown as LanguageModel;

function provider(text: string, delayMs = 0): AiIntroProvider {
  return new AiIntroProvider(config, {
    resolveModel: async () => fakeModel,
    generate: async () => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return { text };
    },
    timeoutMs: 50,
  });
}

describe('describeDigest', () => {
  it('décrit le digest en texte, sans HTML', () => {
    const text = describeDigest(digest);
    expect(text).toContain('Enfant : Alice');
    expect(text).toContain('Journée de 08:00 à 17:00, avec EPS');
    expect(text).toContain('- 08:00–08:55 ACC. PERSO. FRANCAIS');
    expect(text).not.toContain('<');
  });
});

describe('mentionsUnknownTime', () => {
  it('accepte une heure présente dans les données', () => {
    expect(mentionsUnknownTime('Alice termine à 17h.', digest)).toBe(false);
    expect(mentionsUnknownTime('Début à 8:00 et fin 17:00.', digest)).toBe(false);
  });

  it('rejette une heure inventée', () => {
    expect(mentionsUnknownTime('Alice termine à 16h30.', digest)).toBe(true);
    expect(mentionsUnknownTime('Cours à 12:30.', digest)).toBe(true);
  });

  it('ignore les nombres qui ne sont pas des heures', () => {
    expect(mentionsUnknownTime('Elle a 6 cours et 2 devoirs.', digest)).toBe(false);
  });
});

describe('AiIntroProvider', () => {
  it('renvoie le texte nettoyé du modèle', async () => {
    const intro = await provider(
      '  Journée longue pour Alice,\n pense au sac de sport.  ',
    ).generate(digest);
    expect(intro).toBe('Journée longue pour Alice, pense au sac de sport.');
  });

  it('rejette une intro vide, trop longue ou avec une heure inventée', async () => {
    expect(await provider('   ').generate(digest)).toBeUndefined();
    expect(await provider('x'.repeat(801)).generate(digest)).toBeUndefined();
    expect(await provider('Alice finit à 16h30.').generate(digest)).toBeUndefined();
  });

  it('échoue au-delà du délai', async () => {
    await expect(provider('ok', 200).generate(digest)).rejects.toThrow(/délai IA dépassé/);
  });

  it('exige une URL de base pour openai-compatible', async () => {
    const bad = new AiIntroProvider(
      { provider: 'openai-compatible', model: 'm' },
      {
        generate: async () => ({ text: 'x' }),
      },
    );
    await expect(bad.generate(digest)).rejects.toThrow(/AI_BASE_URL/);
  });

  it('résout un modèle pour chaque fournisseur sans appel réseau', async () => {
    const providers: AiConfig['provider'][] = [
      'anthropic',
      'openai',
      'mistral',
      'google',
      'ollama',
    ];
    for (const p of providers) {
      const intro = new AiIntroProvider(
        { provider: p, model: 'm', apiKey: 'k' },
        { generate: async ({ model }) => ({ text: `ok ${typeof model}` }) },
      );
      expect(await intro.generate(digest)).toBe('ok object');
    }
    const compatible = new AiIntroProvider(
      { provider: 'openai-compatible', model: 'm', baseUrl: 'http://localhost:1/v1' },
      { generate: async () => ({ text: 'ok' }) },
    );
    expect(await compatible.generate(digest)).toBe('ok');
  });
});

describe('createIntroProvider', () => {
  it('charge le module IA à la demande', async () => {
    const intro = createIntroProvider({ provider: 'openai-compatible', model: 'm' });
    await expect(intro.generate(digest)).rejects.toThrow(/AI_BASE_URL/);
  });
});
