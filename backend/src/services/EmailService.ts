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

export async function sendDocumentExpiringSoon(
  email: string,
  documentLabel: string,
  daysLeft: number
): Promise<void> {
  const dashboardUrl = `${config.frontendUrl}/dashboard`;
  const html = `
    <p>Votre ${documentLabel} expire dans ${daysLeft} jours.</p>
    <p>Pensez a mettre a jour votre document sur votre espace.</p>
    <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send expiring soon email to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `Votre ${documentLabel} expire dans ${daysLeft} jours`,
    html,
  });
  logger.info(`Document expiring soon email sent to ${email}`);
}

export async function sendDocumentExpired(email: string, documentLabel: string): Promise<void> {
  const dashboardUrl = `${config.frontendUrl}/dashboard`;
  const html = `
    <p>Votre ${documentLabel} a expire et a ete supprime.</p>
    <p>Merci d uploader une nouvelle version.</p>
    <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
  `;
  if (config.env === 'test') {
    logger.debug(`[EmailService] Would send expired email to ${email}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `Votre ${documentLabel} a expire et a ete supprime`,
    html,
  });
  logger.info(`Document expired email sent to ${email}`);
}

export async function sendModerationAlert(
  adminEmail: string,
  folderId: number,
  priority: string,
  motifs: object[]
): Promise<void> {
  const html = `
    <p>Dossier suspect détecté.</p>
    <p>Folder: ${folderId}</p>
    <p>Priorité: ${priority}</p>
    <p>Motifs: ${JSON.stringify(motifs)}</p>
    <p><a href="${config.frontendUrl}/admin/moderation">Ouvrir la modération</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: adminEmail,
    subject: `[RENTERS] Dossier suspect - Modération requise (${priority})`,
    html,
  });
}

export async function sendModerationInfoRequest(
  tenantEmail: string,
  message: string
): Promise<void> {
  const html = `
    <p>Un complément d'information est requis sur votre dossier.</p>
    <p>${message}</p>
    <p><a href="${config.frontendUrl}/dashboard">Voir mon dossier</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: tenantEmail,
    subject: "Votre dossier - Complément d'information requis",
    html,
  });
}

export async function sendModerationResolved(
  tenantEmail: string,
  resolution: 'approved' | 'rejected' | 'fraud_confirmed'
): Promise<void> {
  const content =
    resolution === 'approved'
      ? 'Votre dossier est validé, vous pouvez le partager.'
      : 'Des points nécessitent votre attention, connectez-vous à votre espace.';
  const html = `
    <p>${content}</p>
    <p><a href="${config.frontendUrl}/dashboard">Voir mon dossier</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: tenantEmail,
    subject: 'Votre dossier a été vérifié',
    html,
  });
}

export async function sendGuarantorInvitation(
  email: string,
  tenantName: string,
  role: string,
  token: string
): Promise<void> {
  const url = `${config.frontendUrl}/guarantor/accept?token=${encodeURIComponent(token)}`;
  const html = `
    <p>${tenantName} vous invite à compléter un dossier garant (${role}).</p>
    <p><a href="${url}">${url}</a></p>
    <p>Ce lien expire dans 7 jours.</p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `${tenantName} vous invite à compléter un dossier garant`,
    html,
  });
}

export async function sendAccountSuspended(email: string, reason: string): Promise<void> {
  const html = `
    <p>Votre compte Renters a ete suspendu.</p>
    <p>Motif: ${reason}</p>
    <p>Pour plus d'informations, contactez support@renters.app.</p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Votre compte Renters a ete suspendu',
    html,
  });
}

export async function sendAccountReactivated(email: string): Promise<void> {
  const loginUrl = `${config.frontendUrl}/login`;
  const html = `
    <p>Votre compte Renters a ete reactive.</p>
    <p>Vous pouvez vous reconnecter ici: <a href="${loginUrl}">${loginUrl}</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Votre compte Renters a ete reactive',
    html,
  });
}

export async function sendAccountDeleted(email: string): Promise<void> {
  const html = `
    <p>Votre compte Renters a ete supprime conformement a votre demande RGPD.</p>
    <p>Vos donnees personnelles ont ete effacees selon la politique de retention.</p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Confirmation de suppression de votre compte Renters',
    html,
  });
}

export async function sendFolderViewed(
  email: string,
  agencyName: string,
  viewDate: Date
): Promise<void> {
  const url = `${config.frontendUrl}/shares/history`;
  const html = `
    <p>${agencyName} a consulte votre dossier le ${viewDate.toISOString()}.</p>
    <p><a href="${url}">${url}</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `${agencyName} a consulte votre dossier`,
    html,
  });
}

export async function sendDocumentDownloaded(
  email: string,
  agencyName: string,
  documentLabels: string[]
): Promise<void> {
  const url = `${config.frontendUrl}/shares/history`;
  const html = `
    <p>${agencyName} a telecharge vos documents.</p>
    <p>Documents: ${documentLabels.join(', ')}</p>
    <p><a href="${url}">${url}</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `${agencyName} a telecharge vos documents`,
    html,
  });
}

export async function sendNewFolderShared(
  email: string,
  tenantFirstName: string,
  score: number | null,
  folderUrl: string
): Promise<void> {
  const html = `
    <p>Nouveau dossier recu de ${tenantFirstName}.</p>
    <p>Score: ${score ?? 'N/A'}</p>
    <p><a href="${folderUrl}">${folderUrl}</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `Nouveau dossier recu - ${tenantFirstName}`,
    html,
  });
}

export async function sendFolderExpiringSoon(email: string, daysLeft: number): Promise<void> {
  const url = `${config.frontendUrl}/dashboard`;
  const html = `
    <p>Votre dossier expire dans ${daysLeft} jours.</p>
    <p><a href="${url}">${url}</a></p>
  `;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: `Votre dossier expire dans ${daysLeft} jours`,
    html,
  });
}

export async function sendWeeklyDigest(
  email: string,
  role: string,
  digestData: Record<string, unknown>
): Promise<void> {
  const html = `<p>Votre recap de la semaine (${role}).</p><pre>${JSON.stringify(digestData, null, 2)}</pre>`;
  if (config.env === 'test') return;
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: email,
    subject: 'Votre recap Renters de la semaine',
    html,
  });
}
