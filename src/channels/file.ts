import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Channel, ChannelContext, ChannelResult } from './types.js';

/** Écrit les rendus sur disque : utile en simulation, en CI, ou pour un post-traitement. */
export class FileChannel implements Channel {
  readonly name = 'file';

  constructor(private readonly dir: string) {}

  async send({ digest, renderings, logger }: ChannelContext): Promise<ChannelResult> {
    const target = join(this.dir, digest.targetDate);
    await mkdir(target, { recursive: true });
    const base = join(target, digest.kind);
    await Promise.all([
      writeFile(`${base}.html`, renderings.email.html, 'utf8'),
      writeFile(`${base}.txt`, renderings.email.text, 'utf8'),
      writeFile(`${base}.md`, renderings.markdown.markdown, 'utf8'),
      writeFile(`${base}.json`, `${JSON.stringify(digest, null, 2)}\n`, 'utf8'),
    ]);
    logger.info(`Fichiers écrits dans ${target}`);
    return { channel: this.name, delivered: true, detail: target };
  }
}
