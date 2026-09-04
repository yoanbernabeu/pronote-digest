import type { Logger } from '../core/logger.js';
import type { Digest } from '../core/model.js';
import type { EmailRendering, MarkdownRendering } from '../formatters/index.js';

/** Tout ce qu'un canal peut avoir besoin d'envoyer, rendu une seule fois par le pipeline. */
export interface Renderings {
  email: EmailRendering;
  markdown: MarkdownRendering;
}

export interface ChannelContext {
  digest: Digest;
  renderings: Renderings;
  logger: Logger;
}

export interface ChannelResult {
  channel: string;
  delivered: boolean;
  detail: string;
}

/**
 * Un canal reçoit le digest et ses rendus, et le livre quelque part.
 * Ajouter un canal = implémenter cette interface et l'enregistrer dans `registry.ts`.
 */
export interface Channel {
  readonly name: string;
  send(context: ChannelContext): Promise<ChannelResult>;
}
