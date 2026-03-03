import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const transporter =
  config.env === 'test'
    ? { sendMail: async () => ({ messageId: 'test-id' }) }
    : nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: config.email.sendgridKey,
        },
      });

export async function sendVerificationEmail(
  to: string,
  verificationToken: string
): Promise<void> {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  const html = `
    <p>Bienvenue sur Pouraccord.</p>
    <p>Cliquez sur le lien ci-dessous pour valider votre adresse email :</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>Ce lien expire dans 24 heures.</p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send verification to ${to}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to,
    subject: 'Validez votre adresse email — Pouraccord',
    html,
  });
  logger.info(`Verification email sent to ${to}`);
}
