import { pathToFileURL } from 'node:url';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FetchIcsError, fetchIcs } from '../../src/sources/pronote/fetch.js';
import { fixturePath, readFixture } from '../helpers/fixtures.js';

const ics = readFixture('pronote-4e.ics');
const server = setupServer(
  http.get('https://pronote.test/ok.ics', () =>
    HttpResponse.text(ics, { headers: { 'content-type': 'text/calendar' } }),
  ),
  http.get('https://pronote.test/expired.ics', () =>
    HttpResponse.text('<html>Session expirée</html>'),
  ),
  http.get('https://pronote.test/missing.ics', () => new HttpResponse(null, { status: 404 })),
  http.get('https://pronote.test/slow.ics', async () => {
    await new Promise((r) => setTimeout(r, 200));
    return HttpResponse.text(ics);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchIcs', () => {
  it('renvoie le corps du flux', async () => {
    const body = await fetchIcs('https://pronote.test/ok.ics?icalsecurise=SECRET');
    expect(body).toContain('BEGIN:VCALENDAR');
  });

  it('refuse une réponse qui n’est pas un calendrier, sans divulguer le jeton', async () => {
    await expect(fetchIcs('https://pronote.test/expired.ics?icalsecurise=SECRET')).rejects.toThrow(
      FetchIcsError,
    );
    await expect(
      fetchIcs('https://pronote.test/expired.ics?icalsecurise=SECRET'),
    ).rejects.not.toThrow(/SECRET/);
  });

  it('refuse une erreur HTTP', async () => {
    await expect(fetchIcs('https://pronote.test/missing.ics')).rejects.toThrow(/HTTP 404/);
  });

  it('abandonne au-delà du délai', async () => {
    await expect(fetchIcs('https://pronote.test/slow.ics', { timeoutMs: 20 })).rejects.toThrow(
      /délai dépassé/,
    );
  });

  it('lit un fichier local via file://', async () => {
    const body = await fetchIcs(pathToFileURL(fixturePath('pronote-4e.ics')).href);
    expect(body).toContain('BEGIN:VCALENDAR');
  });

  it('signale un fichier local absent ou invalide', async () => {
    await expect(fetchIcs('file:///nulle/part.ics')).rejects.toThrow(/Lecture impossible/);
    await expect(fetchIcs(pathToFileURL(fixturePath('../../package.json')).href)).rejects.toThrow(
      /n'est pas un calendrier/,
    );
  });
});
