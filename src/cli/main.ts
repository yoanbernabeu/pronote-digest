import { Command } from 'commander';
import { ConfigError, parseConfig, RAW_KEYS, type RawConfig } from '../config.js';
import { consoleLogger } from '../core/logger.js';
import { runDigest } from '../core/run.js';
import { createIntroProvider } from '../intro/index.js';

function rawFromEnv(env: NodeJS.ProcessEnv): RawConfig {
  const raw: RawConfig = {};
  for (const key of RAW_KEYS) raw[key] = env[key];
  return raw;
}

const program = new Command()
  .name('pronote-digest')
  .description('Digest quotidien (planning ou devoirs) à partir des flux iCal Pronote.')
  .argument('<digest>', 'planning | homework')
  .option('-d, --date <AAAA-MM-JJ>', 'jour de préparation (défaut : aujourd’hui, heure de Paris)')
  .option('--dry-run', 'ne rien envoyer, écrire seulement l’archive')
  .option('-c, --channels <liste>', 'canaux, séparés par des virgules (défaut : email)')
  .option('--no-archive', 'ne pas lire ni écrire l’archive')
  .action(
    async (
      digest: string,
      options: { date?: string; dryRun?: boolean; channels?: string; archive: boolean },
    ) => {
      const raw = rawFromEnv(process.env);
      raw.DIGEST = digest;
      if (options.date !== undefined) raw.DATE = options.date;
      if (options.dryRun === true) raw.DRY_RUN = 'true';
      if (options.channels !== undefined) raw.CHANNELS = options.channels;
      if (!options.archive) raw.ARCHIVE_DIR = 'none';
      try {
        const config = parseConfig(raw);
        const result = await runDigest(config, {
          logger: consoleLogger,
          ...(config.ai === undefined ? {} : { intro: createIntroProvider(config.ai) }),
        });
        if (result.skipped) {
          consoleLogger.info('Aucun envoi.');
          return;
        }
        consoleLogger.info(`Sujet : ${result.subject}`);
        for (const d of result.deliveries) {
          consoleLogger.info(`${d.channel} : ${d.delivered ? 'livré' : 'non livré'} (${d.detail})`);
        }
      } catch (error) {
        if (error instanceof ConfigError) consoleLogger.error(error.message);
        else consoleLogger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );

await program.parseAsync(process.argv);
