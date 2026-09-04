import * as core from '@actions/core';
import { ConfigError, parseConfig, RAW_KEYS, type RawConfig } from '../config.js';
import type { Logger } from '../core/logger.js';
import { runDigest } from '../core/run.js';
import { createIntroProvider } from '../intro/index.js';

/** Les entrées de l'action portent le même nom que les variables d'environnement, en minuscules. */
function rawFromInputs(): RawConfig {
  const raw: RawConfig = {};
  for (const key of RAW_KEYS) {
    const value = core.getInput(key.toLowerCase());
    if (value !== '') raw[key] = value;
  }
  return raw;
}

const logger: Logger = {
  info: (m) => core.info(m),
  warn: (m) => core.warning(m),
  error: (m) => core.error(m),
};

async function main(): Promise<void> {
  const raw = rawFromInputs();
  for (const secret of [raw.SMTP_PASS, raw.AI_API_KEY]) {
    if (secret !== undefined) core.setSecret(secret);
  }
  const config = parseConfig(raw);
  for (const child of config.children) core.setSecret(child.ics);

  const result = await runDigest(config, {
    logger,
    ...(config.ai === undefined ? {} : { intro: createIntroProvider(config.ai) }),
  });

  core.setOutput('skipped', String(result.skipped));
  core.setOutput('target-date', result.digest.targetDate);
  core.setOutput('school-day', String(result.digest.schoolDay));
  core.setOutput('subject', result.subject);
  core.setOutput('archive-json', result.archive?.json ?? '');
  core.setOutput('archive-html', result.archive?.html ?? '');
  core.setOutput('archive-markdown', result.archive?.markdown ?? '');
  core.setOutput('delivered', String(result.deliveries.every((d) => d.delivered)));
}

try {
  await main();
} catch (error) {
  if (error instanceof ConfigError) core.setFailed(error.message);
  else core.setFailed(error instanceof Error ? error.message : String(error));
}
