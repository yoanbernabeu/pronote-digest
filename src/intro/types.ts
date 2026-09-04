import type { Digest } from '../core/model.js';

/**
 * Fournisseur d'introduction : quelques phrases en tête du digest.
 * Optionnel. Une implémentation ne doit jamais faire échouer l'envoi : en cas de doute,
 * renvoyer `undefined`.
 */
export interface IntroProvider {
  generate(digest: Digest): Promise<string | undefined>;
}
