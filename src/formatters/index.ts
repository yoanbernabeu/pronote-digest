import { Eta } from 'eta';
import { convert } from 'html-to-text';
import mjml2html from 'mjml';
import type { Digest } from '../core/model.js';
import { EMAIL_TEMPLATE } from './templates/email.mjml.js';
import { buildView, type ViewOptions } from './view.js';

export interface EmailRendering {
  subject: string;
  html: string;
  text: string;
}

export { type MarkdownRendering, renderMarkdown } from './markdown.js';

const htmlEta = new Eta({ autoEscape: true, autoTrim: false, rmWhitespace: false });

type Mjml = (
  input: string,
  options?: { validationLevel?: 'strict' | 'soft' | 'skip' },
) => Promise<{
  html: string;
  errors: Array<{ formattedMessage: string }>;
}>;

/** mjml 5 est asynchrone ; les types publiés décrivent encore la version synchrone. */
const renderMjml = mjml2html as unknown as Mjml;

export async function renderEmail(
  digest: Digest,
  options: ViewOptions = {},
): Promise<EmailRendering> {
  const view = buildView(digest, options);
  const mjml = htmlEta.renderString(EMAIL_TEMPLATE, view);
  const result = await renderMjml(mjml, { validationLevel: 'strict' });
  if (result.errors.length > 0) {
    throw new Error(
      `Gabarit MJML invalide : ${result.errors.map((e) => e.formattedMessage).join(' ; ')}`,
    );
  }
  const text = convert(result.html, {
    wordwrap: 100,
    selectors: [
      { selector: 'title', format: 'skip' },
      { selector: 'div[style*="display:none"]', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'table', format: 'dataTable' },
    ],
  }).trim();
  return { subject: view.subject, html: result.html, text };
}
