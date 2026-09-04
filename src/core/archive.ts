import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Renderings } from '../channels/types.js';
import { type Digest, DigestSchema } from './model.js';

export interface ArchivePaths {
  json: string;
  html: string;
  markdown: string;
}

function archivePaths(dir: string, digest: Pick<Digest, 'targetDate' | 'kind'>): ArchivePaths {
  const base = join(dir, digest.targetDate, digest.kind);
  return { json: `${base}.json`, html: `${base}.html`, markdown: `${base}.md` };
}

/** Lit le digest archivé pour la même date et le même type ; `undefined` s'il manque ou est illisible. */
export async function readPreviousDigest(
  dir: string,
  digest: Pick<Digest, 'targetDate' | 'kind'>,
): Promise<Digest | undefined> {
  try {
    const raw = await readFile(archivePaths(dir, digest).json, 'utf8');
    const parsed = DigestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
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
