import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return join(here, '..', 'fixtures', name);
}

export function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}
