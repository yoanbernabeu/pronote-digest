import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpConfig } from '../config.js';
import type { Channel, ChannelContext, ChannelResult } from './types.js';

export interface EmailChannelOptions {
  /** Transport injectable pour les tests ; par défaut un transport SMTP nodemailer. */
  transport?: Transporter;
}

export function createSmtpTransport(smtp: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user !== undefined ? { auth: { user: smtp.user, pass: smtp.pass ?? '' } } : {}),
  });
}

export class EmailChannel implements Channel {
  readonly name = 'email';
  private readonly transport: Transporter;

  constructor(
    private readonly smtp: SmtpConfig,
    options: EmailChannelOptions = {},
  ) {
    this.transport = options.transport ?? createSmtpTransport(smtp);
  }

  async send({ renderings, logger }: ChannelContext): Promise<ChannelResult> {
    const info = await this.transport.sendMail({
      from: this.smtp.from,
      to: this.smtp.to,
      subject: renderings.email.subject,
      html: renderings.email.html,
      text: renderings.email.text,
    });
    const detail = `${this.smtp.to.length} destinataire(s), id ${info.messageId}`;
    logger.info(`Mail envoyé : ${detail}`);
    return { channel: this.name, delivered: true, detail };
  }
}
