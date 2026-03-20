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

export async function sendAgencyInvitationEmail(
  to: string,
  invitationToken: string
): Promise<void> {
  const joinUrl = `${config.frontendUrl}/agent/join?token=${encodeURIComponent(invitationToken)}`;
  const html = `
    <p>Vous avez été invité(e) à rejoindre une agence sur Pouraccord.</p>
    <p>Utilisez le lien ci-dessous pour rejoindre l'espace agence :</p>
    <p><a href="${joinUrl}">${joinUrl}</a></p>
    <p>Ce lien expire dans 7 jours.</p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send agency invitation to ${to}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to,
    subject: 'Invitation agence — Pouraccord',
    html,
  });
  logger.info(`Agency invitation email sent to ${to}`);
}

export async function sendSubscriptionConfirmation(email: string): Promise<void> {
  const billingUrl = `${config.frontendUrl}/billing`;
  const html = `
    <p>Votre abonnement Renters est activé.</p>
    <p>Montant: 300 EUR HT / mois.</p>
    <p>Accédez a votre espace facturation: <a href="${billingUrl}">${billingUrl}</a></p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send subscription confirmation to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Votre abonnement Renters est activé',
    html,
  });
  logger.info(`Subscription confirmation email sent to ${email}`);
}

export async function sendPaymentFailed(
  email: string,
  attemptCount: number
): Promise<void> {
  const billingUrl = `${config.frontendUrl}/billing`;
  const suspensionText =
    attemptCount >= 3
      ? '<p>Votre compte risque d etre suspendu (ou est suspendu) apres plusieurs echecs.</p>'
      : '';
  const html = `
    <p>Nous n avons pas pu traiter votre dernier paiement.</p>
    <p>Merci de mettre a jour votre moyen de paiement:</p>
    <p><a href="${billingUrl}">${billingUrl}</a></p>
    <p>Nombre de tentatives: ${attemptCount}</p>
    ${suspensionText}
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send payment failed email to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Echec de paiement - Action requise',
    html,
  });
  logger.info(`Payment failed email sent to ${email}`);
}

export async function sendSubscriptionCancelled(email: string): Promise<void> {
  const html = `
    <p>Votre abonnement Renters a ete resilie.</p>
    <p>Votre acces reste actif jusqu a la fin de la periode en cours.</p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send subscription cancelled email to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Votre abonnement Renters a ete resilie',
    html,
  });
  logger.info(`Subscription cancelled email sent to ${email}`);
}

export async function sendTrialEnding(email: string, daysLeft: number): Promise<void> {
  const billingUrl = `${config.frontendUrl}/billing`;
  const html = `
    <p>Votre essai gratuit se termine dans ${daysLeft} jours.</p>
    <p>Pour continuer a utiliser Renters, activez votre abonnement:</p>
    <p><a href="${billingUrl}">${billingUrl}</a></p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send trial ending reminder to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `Votre essai gratuit se termine dans ${daysLeft} jours`,
    html,
  });
  logger.info(`Trial ending email sent to ${email}`);
}
