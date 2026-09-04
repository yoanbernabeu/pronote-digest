import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig, type RawConfig } from '../src/config.js';

const children = JSON.stringify([{ name: 'Alice', ics: 'https://example.test/alice.ics' }]);

const minimalEmail: RawConfig = {
  CHILDREN: children,
  DIGEST: 'planning',
  SMTP_HOST: 'smtp.example.test',
  MAIL_FROM: 'digest@example.test',
  MAIL_TO: 'parent1@example.test, parent2@example.test',
};

describe('parseConfig', () => {
  it('applique les valeurs par défaut', () => {
    const config = parseConfig(minimalEmail);
    expect(config).toMatchObject({
      kind: 'planning',
      channels: ['email'],
      subjectPrefix: '[Pronote]',
      archiveDir: 'archive',
      onNoSchool: 'notify',
      requireHomeworkData: true,
      dryRun: false,
      fileDir: 'out',
    });
    expect(config.smtp).toMatchObject({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      to: ['parent1@example.test', 'parent2@example.test'],
    });
    expect(config.ai).toBeUndefined();
  });

  it('lit les enfants depuis le JSON', () => {
    expect(parseConfig(minimalEmail).children).toEqual([
      { name: 'Alice', ics: 'https://example.test/alice.ics' },
    ]);
  });

  it('refuse un JSON enfants invalide', () => {
    expect(() => parseConfig({ ...minimalEmail, CHILDREN: '{oops' })).toThrow(ConfigError);
  });

  it('refuse une liste d’enfants vide', () => {
    expect(() => parseConfig({ ...minimalEmail, CHILDREN: '[]' })).toThrow(/au moins un enfant/);
  });

  it('refuse un type de digest inconnu', () => {
    expect(() => parseConfig({ ...minimalEmail, DIGEST: 'notes' })).toThrow(ConfigError);
  });

  it('exige le SMTP quand le canal email est actif', () => {
    expect(() => parseConfig({ CHILDREN: children, DIGEST: 'planning' })).toThrow(/SMTP_HOST/);
  });

  it('tolère l’absence de SMTP en simulation', () => {
    const config = parseConfig({ CHILDREN: children, DIGEST: 'planning', DRY_RUN: 'true' });
    expect(config.channels).toEqual(['email']);
    expect(config.smtp).toBeUndefined();
  });

  it('accepte le canal fichier seul, sans SMTP', () => {
    const config = parseConfig({ CHILDREN: children, DIGEST: 'homework', CHANNELS: 'file' });
    expect(config.channels).toEqual(['file']);
    expect(config.smtp).toBeUndefined();
  });

  it('convertit les booléens et les nombres', () => {
    const config = parseConfig({
      ...minimalEmail,
      DRY_RUN: 'true',
      REQUIRE_HOMEWORK_DATA: 'off',
      SMTP_PORT: '465',
      SMTP_SECURE: '1',
      FETCH_TIMEOUT_MS: '5000',
    });
    expect(config.dryRun).toBe(true);
    expect(config.requireHomeworkData).toBe(false);
    expect(config.smtp?.port).toBe(465);
    expect(config.smtp?.secure).toBe(true);
    expect(config.fetchTimeoutMs).toBe(5000);
  });

  it('refuse une date mal formée', () => {
    expect(() => parseConfig({ ...minimalEmail, DATE: '07/09/2026' })).toThrow(ConfigError);
    expect(parseConfig({ ...minimalEmail, DATE: '2026-09-07' }).date).toBe('2026-09-07');
    expect(parseConfig({ ...minimalEmail, DATE: '' }).date).toBeUndefined();
  });

  it('lit la configuration IA seulement si un fournisseur est donné', () => {
    expect(parseConfig({ ...minimalEmail, AI_MODEL: 'x' }).ai).toBeUndefined();
    const config = parseConfig({
      ...minimalEmail,
      AI_PROVIDER: 'anthropic',
      AI_MODEL: 'claude-opus-5',
      AI_API_KEY: 'k',
    });
    expect(config.ai).toEqual({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'k' });
  });

  it('limite l’intro IA au planning par défaut, configurable', () => {
    expect(parseConfig(minimalEmail).aiDigests).toEqual(['planning']);
    expect(parseConfig({ ...minimalEmail, AI_DIGESTS: 'planning, homework' }).aiDigests).toEqual([
      'planning',
      'homework',
    ]);
    expect(() => parseConfig({ ...minimalEmail, AI_DIGESTS: 'notes' })).toThrow(ConfigError);
  });

  it('refuse un fournisseur IA inconnu', () => {
    expect(() => parseConfig({ ...minimalEmail, AI_PROVIDER: 'skynet', AI_MODEL: 'x' })).toThrow(
      ConfigError,
    );
  });

  it('permet de désactiver l’archive avec la valeur none', () => {
    expect(parseConfig({ ...minimalEmail, ARCHIVE_DIR: '' }).archiveDir).toBe('archive');
    expect(parseConfig({ ...minimalEmail, ARCHIVE_DIR: 'none' }).archiveDir).toBe('');
  });
});
