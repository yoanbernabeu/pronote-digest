import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Channel } from '../../src/channels/types.js';
import { parseConfig, type RawConfig } from '../../src/config.js';
import { HomeworkDataMissingError, runDigest } from '../../src/core/run.js';
import { readFixture } from '../helpers/fixtures.js';

const ics4e = readFixture('pronote-4e.ics');
const ics6e = readFixture('pronote-6e.ics');
const stripped = ics4e.replace(
  /<strong>(Pour le|Donné le|Contenu pédagogique)[\s\S]*?(?=\r\n(?:X-ALT-DESC|COLOR))/g,
  '',
);

const server = setupServer(
  http.get('https://pronote.test/alice.ics', () => HttpResponse.text(ics4e)),
  http.get('https://pronote.test/bob.ics', () => HttpResponse.text(ics6e)),
  http.get('https://pronote.test/nohomework.ics', () => HttpResponse.text(stripped)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pronote-run-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const children = JSON.stringify([
  { name: 'Alice', ics: 'https://pronote.test/alice.ics' },
  { name: 'Bob', ics: 'https://pronote.test/bob.ics' },
]);

function config(overrides: RawConfig = {}) {
  return parseConfig({
    CHILDREN: children,
    DIGEST: 'planning',
    CHANNELS: 'file',
    FILE_DIR: join(dir, 'out'),
    ARCHIVE_DIR: join(dir, 'archive'),
    DATE: '2026-09-06',
    ...overrides,
  });
}

function spyChannel(): Channel & { calls: number } {
  const channel = {
    name: 'file',
    calls: 0,
    async send() {
      channel.calls += 1;
      return { channel: 'file', delivered: true, detail: 'ok' };
    },
  };
  return channel;
}

describe('runDigest', () => {
  it('télécharge, construit, archive et livre le digest', async () => {
    const channel = spyChannel();
    const result = await runDigest(config(), { channels: [channel] });
    expect(result.skipped).toBe(false);
    expect(result.subject).toBe('[Pronote] Planning du lundi 7 septembre 2026');
    expect(result.digest.children.map((c) => c.name)).toEqual(['Alice', 'Bob']);
    expect(channel.calls).toBe(1);
    expect(result.deliveries).toEqual([{ channel: 'file', delivered: true, detail: 'ok' }]);
    const json = JSON.parse(
      await readFile(join(dir, 'archive', '2026-09-07', 'planning.json'), 'utf8'),
    );
    expect(json.targetDate).toBe('2026-09-07');
    await expect(stat(join(dir, 'archive', '2026-09-07', 'planning.html'))).resolves.toBeDefined();
  });

  it('n’appelle aucun canal en simulation mais écrit l’archive', async () => {
    const channel = spyChannel();
    const result = await runDigest(config({ DRY_RUN: 'true' }), { channels: [channel] });
    expect(channel.calls).toBe(0);
    expect(result.archive?.json).toContain('planning.json');
  });

  it('ne fait rien un jour sans cours quand ON_NO_SCHOOL=skip', async () => {
    const channel = spyChannel();
    const result = await runDigest(config({ DATE: '2026-09-12', ON_NO_SCHOOL: 'skip' }), {
      channels: [channel],
    });
    expect(result.skipped).toBe(true);
    expect(channel.calls).toBe(0);
  });

  it('envoie un digest court un jour sans cours par défaut', async () => {
    const channel = spyChannel();
    const result = await runDigest(config({ DATE: '2026-09-12' }), { channels: [channel] });
    expect(result.skipped).toBe(false);
    expect(result.digest.schoolDay).toBe(false);
    expect(channel.calls).toBe(1);
  });

  it('refuse le digest devoirs quand aucun flux n’a de cahier de textes', async () => {
    const only = JSON.stringify([{ name: 'A', ics: 'https://pronote.test/nohomework.ics' }]);
    await expect(
      runDigest(config({ DIGEST: 'homework', CHILDREN: only }), { channels: [spyChannel()] }),
    ).rejects.toThrow(HomeworkDataMissingError);
    const result = await runDigest(
      config({ DIGEST: 'homework', CHILDREN: only, REQUIRE_HOMEWORK_DATA: 'false' }),
      { channels: [spyChannel()] },
    );
    expect(result.skipped).toBe(false);
  });

  it('fonctionne sans archive', async () => {
    const result = await runDigest(config({ ARCHIVE_DIR: 'none' }), { channels: [spyChannel()] });
    expect(result.archive).toBeUndefined();
  });

  it('intègre l’intro quand un fournisseur la donne, et survit à son échec', async () => {
    const ok = await runDigest(config(), {
      channels: [spyChannel()],
      intro: { generate: async () => 'Bonne soirée.' },
    });
    expect(ok.digest.intro).toBe('Bonne soirée.');
    const warnings: string[] = [];
    const failed = await runDigest(config(), {
      channels: [spyChannel()],
      intro: {
        generate: async () => {
          throw new Error('quota');
        },
      },
      logger: { info: () => undefined, warn: (m) => warnings.push(m), error: () => undefined },
    });
    expect(failed.digest.intro).toBeUndefined();
    expect(warnings.join(' ')).toContain('quota');
  });

  it('ne demande pas d’intro pour un digest exclu par AI_DIGESTS', async () => {
    let calls = 0;
    const intro = {
      generate: async () => {
        calls += 1;
        return 'Intro.';
      },
    };
    const homework = await runDigest(config({ DIGEST: 'homework' }), {
      channels: [spyChannel()],
      intro,
    });
    expect(homework.digest.intro).toBeUndefined();
    expect(calls).toBe(0);
    const both = await runDigest(config({ DIGEST: 'homework', AI_DIGESTS: 'planning,homework' }), {
      channels: [spyChannel()],
      intro,
    });
    expect(both.digest.intro).toBe('Intro.');
  });

  it('prend la date de Paris quand aucune date n’est donnée', async () => {
    const result = await runDigest(config({ DATE: '' }), {
      channels: [spyChannel()],
      now: () => new Date('2026-09-06T21:30:00Z'),
    });
    expect(result.digest.targetDate).toBe('2026-09-07');
  });
});
