import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export class FetchIcsError extends Error {
  override readonly name = 'FetchIcsError';
}

export interface FetchIcsOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function redact(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '(url invalide)';
  }
}

/**
 * Télécharge un flux iCal. Le jeton est dans l'URL : il n'apparaît jamais dans les erreurs.
 * Les URL `file://` sont lues sur disque, pour les tests et les démonstrations hors ligne.
 */
export async function fetchIcs(url: string, options: FetchIcsOptions = {}): Promise<string> {
  if (url.startsWith('file:')) {
    try {
      return checkCalendar(await readFile(fileURLToPath(url), 'utf8'), url);
    } catch (error) {
      if (error instanceof FetchIcsError) throw error;
      throw new FetchIcsError(`Lecture impossible (${redact(url)}) : ${String(error)}`);
    }
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'text/calendar, */*;q=0.5', 'user-agent': 'pronote-digest' },
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError' ? 'délai dépassé' : String(error);
    throw new FetchIcsError(`Téléchargement impossible (${redact(url)}) : ${reason}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new FetchIcsError(`Réponse HTTP ${response.status} pour ${redact(url)}`);
  }
  return checkCalendar(await response.text(), url);
}

function checkCalendar(body: string, url: string): string {
  if (!body.includes('BEGIN:VCALENDAR')) {
    throw new FetchIcsError(
      `Le contenu reçu de ${redact(url)} n'est pas un calendrier : jeton expiré ou URL erronée ?`,
    );
  }
  return body;
}
