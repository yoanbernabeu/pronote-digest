import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSmtpTransport, EmailChannel } from '../../src/channels/email.js';
import { FileChannel } from '../../src/channels/file.js';
import { createChannels } from '../../src/channels/registry.js';
import type { ChannelContext } from '../../src/channels/types.js';
import { parseConfig } from '../../src/config.js';
import { silentLogger } from '../../src/core/logger.js';
import type { Digest } from '../../src/core/model.js';

const digest: Digest = {
  version: 1,
  generatedAt: '2026-09-06T17:00:00.000Z',
  targetDate: '2026-09-07',
  kind: 'planning',
  schoolDay: true,
  children: [],
};

const context: ChannelContext = {
  digest,
  renderings: {
    email: { subject: 'Sujet', html: '<p>html</p>', text: 'texte' },
    markdown: { subject: 'Sujet', markdown: '# md\n' },
  },
  logger: silentLogger,
};

describe('EmailChannel', () => {
  it('envoie via le transport avec sujet, HTML et texte', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const channel = new EmailChannel(
      {
        host: 'smtp.test',
        port: 587,
        secure: false,
        from: 'digest@test',
        to: ['a@test', 'b@test'],
      },
      { transport },
    );
    const result = await channel.send(context);
    expect(result).toMatchObject({ channel: 'email', delivered: true });
    expect(result.detail).toContain('2 destinataire(s)');
  });

  it('construit un transport SMTP avec ou sans authentification', () => {
    const withAuth = createSmtpTransport({
      host: 'smtp.test',
      port: 465,
      secure: true,
      user: 'u',
      pass: 'p',
      from: 'f@test',
      to: ['a@test'],
    });
    expect(withAuth.options).toMatchObject({ host: 'smtp.test', port: 465, secure: true });
    const anonymous = createSmtpTransport({
      host: 'smtp.test',
      port: 25,
      secure: false,
      from: 'f@test',
      to: ['a@test'],
    });
    expect(anonymous.options).not.toHaveProperty('auth');
  });
});

describe('FileChannel', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pronote-digest-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('écrit HTML, texte, Markdown et JSON dans un dossier par date', async () => {
    const result = await new FileChannel(dir).send(context);
    expect(result.delivered).toBe(true);
    const base = join(dir, '2026-09-07', 'planning');
    expect(await readFile(`${base}.html`, 'utf8')).toBe('<p>html</p>');
    expect(await readFile(`${base}.txt`, 'utf8')).toBe('texte');
    expect(await readFile(`${base}.md`, 'utf8')).toBe('# md\n');
    expect(JSON.parse(await readFile(`${base}.json`, 'utf8'))).toEqual(digest);
  });
});

describe('createChannels', () => {
  const children = JSON.stringify([{ name: 'A', ics: 'https://x.test/a.ics' }]);

  it('instancie les canaux demandés dans l’ordre', () => {
    const config = parseConfig({
      CHILDREN: children,
      DIGEST: 'planning',
      CHANNELS: 'file,email',
      SMTP_HOST: 'smtp.test',
      MAIL_FROM: 'f@example.test',
      MAIL_TO: 'a@example.test',
    });
    expect(createChannels(config).map((c) => c.name)).toEqual(['file', 'email']);
  });

  it('accepte des remplacements pour les tests', () => {
    const config = parseConfig({ CHILDREN: children, DIGEST: 'planning', CHANNELS: 'file' });
    const fake = {
      name: 'file',
      send: async () => ({ channel: 'file', delivered: true, detail: '' }),
    };
    expect(createChannels(config, { file: fake })[0]).toBe(fake);
  });
});
