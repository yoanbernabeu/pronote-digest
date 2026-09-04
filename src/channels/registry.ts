import type { Config } from '../config.js';
import { EmailChannel } from './email.js';
import { FileChannel } from './file.js';
import type { Channel } from './types.js';

export type ChannelName = Config['channels'][number];

type ChannelFactory = (config: Config) => Channel;

/** Registre des canaux disponibles. Ajouter une entrée ici pour exposer un nouveau canal. */
const FACTORIES: Record<ChannelName, ChannelFactory> = {
  email: (config) => {
    if (config.smtp === undefined) throw new Error('Configuration SMTP absente.');
    return new EmailChannel(config.smtp);
  },
  file: (config) => new FileChannel(config.fileDir),
};

export function createChannels(
  config: Config,
  overrides: Partial<Record<ChannelName, Channel>> = {},
): Channel[] {
  return config.channels.map((name) => overrides[name] ?? FACTORIES[name](config));
}
