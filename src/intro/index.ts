import type { AiConfig } from '../config.js';
import type { IntroProvider } from './types.js';

/**
 * Fabrique du fournisseur d'introduction. Le module IA n'est chargé que si un fournisseur
 * est configuré : sans configuration, aucune dépendance IA n'est importée.
 */
export function createIntroProvider(config: AiConfig): IntroProvider {
  return {
    async generate(digest) {
      const { AiIntroProvider } = await import('./ai.js');
      return new AiIntroProvider(config).generate(digest);
    },
  };
}
