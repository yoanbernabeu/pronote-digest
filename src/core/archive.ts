import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Renderings } from '../channels/types.js';
import type { Digest } from './model.js';

export interface ArchivePaths {
  json: string;
  html: string;
  markdown: string;
}

function archivePaths(dir: string, digest: Pick<Digest, 'targetDate' | 'kind'>): ArchivePaths {
  const base = join(dir, digest.targetDate, digest.kind);
  return { json: `${base}.json`, html: `${base}.html`, markdown: `${base}.md` };
}

export async function writeArchive(
  dir: string,
  digest: Digest,
  renderings: Renderings,
): Promise<ArchivePaths> {
  const paths = archivePaths(dir, digest);
  await mkdir(join(dir, digest.targetDate), { recursive: true });
  await Promise.all([
    writeFile(paths.json, `${JSON.stringify(digest, null, 2)}\n`, 'utf8'),
    writeFile(paths.html, renderings.email.html, 'utf8'),
    writeFile(paths.markdown, renderings.markdown.markdown, 'utf8'),
  ]);
  return paths;
}
