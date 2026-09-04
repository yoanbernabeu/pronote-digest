import { createChannels } from '../channels/registry.js';
import type { Channel, ChannelResult, Renderings } from '../channels/types.js';
import type { Config } from '../config.js';
import { renderEmail, renderMarkdown } from '../formatters/index.js';
import type { IntroProvider } from '../intro/types.js';
import { fetchIcs } from '../sources/pronote/fetch.js';
import { parsePronoteIcs } from '../sources/pronote/parse.js';
import { type ArchivePaths, writeArchive } from './archive.js';
import { buildDigest, type ChildFeed } from './digest.js';
import { type Logger, silentLogger } from './logger.js';
import type { Digest } from './model.js';
import { parisDate } from './time.js';

export interface RunDependencies {
  logger?: Logger;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  channels?: Channel[];
  intro?: IntroProvider;
}

export interface RunResult {
  digest: Digest;
  subject: string;
  skipped: boolean;
  archive: ArchivePaths | undefined;
  deliveries: ChannelResult[];
}

export class HomeworkDataMissingError extends Error {
  override readonly name = 'HomeworkDataMissingError';
}

async function loadChildren(
  config: Config,
  deps: RunDependencies,
  logger: Logger,
): Promise<ChildFeed[]> {
  return Promise.all(
    config.children.map(async (child) => {
      const fetchOptions = {
        timeoutMs: config.fetchTimeoutMs,
        ...(deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl }),
      };
      const ics = await fetchIcs(child.ics, fetchOptions);
      const feed = parsePronoteIcs(ics);
      logger.info(
        `${child.name} : ${feed.lessons.length} cours, ${feed.events.length} périodes, cahier de textes ${feed.hasHomeworkData ? 'présent' : 'absent'}`,
      );
      return { name: child.name, feed };
    }),
  );
}

export async function runDigest(config: Config, deps: RunDependencies = {}): Promise<RunResult> {
  const logger = deps.logger ?? silentLogger;
  const now = deps.now ?? (() => new Date());
  const today = config.date ?? parisDate(now());

  const children = await loadChildren(config, deps, logger);
  if (
    config.kind === 'homework' &&
    config.requireHomeworkData &&
    !children.some((c) => c.feed.hasHomeworkData)
  ) {
    throw new HomeworkDataMissingError(
      'Aucun flux ne contient de cahier de textes : le digest devoirs est impossible. Vérifiez l’export iCal côté établissement, ou passez REQUIRE_HOMEWORK_DATA à false.',
    );
  }

  const { digest } = buildDigest({
    kind: config.kind,
    today,
    generatedAt: now().toISOString(),
    children,
  });
  logger.info(`Jour visé : ${digest.targetDate}${digest.schoolDay ? '' : ' (pas de cours)'}`);

  if (!digest.schoolDay && config.onNoSchool === 'skip') {
    logger.info('Pas de cours et ON_NO_SCHOOL=skip : rien à envoyer.');
    return { digest, subject: '', skipped: true, archive: undefined, deliveries: [] };
  }

  if (deps.intro !== undefined && config.aiDigests.includes(config.kind)) {
    try {
      const intro = await deps.intro.generate(digest);
      if (intro !== undefined) digest.intro = intro;
    } catch (error) {
      logger.warn(`Intro IA ignorée : ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const viewOptions = { subjectPrefix: config.subjectPrefix };
  const renderings: Renderings = {
    email: await renderEmail(digest, viewOptions),
    markdown: renderMarkdown(digest, viewOptions),
  };

  const archive =
    config.archiveDir === ''
      ? undefined
      : await writeArchive(config.archiveDir, digest, renderings);
  if (archive !== undefined) logger.info(`Archive écrite : ${archive.json}`);

  if (config.dryRun) {
    logger.info('Simulation : aucun canal appelé.');
    return { digest, subject: renderings.email.subject, skipped: false, archive, deliveries: [] };
  }

  const channels = deps.channels ?? createChannels(config);
  const deliveries: ChannelResult[] = [];
  for (const channel of channels) {
    deliveries.push(await channel.send({ digest, renderings, logger }));
  }
  return { digest, subject: renderings.email.subject, skipped: false, archive, deliveries };
}
