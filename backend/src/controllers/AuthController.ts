import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, EmailVerificationToken, PasswordResetToken } from '../models';
import { successResponse, errorResponse } from '../utils/response';
import { sendVerificationEmail } from '../services/EmailService';
import {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verify2faSchema,
} from '../validators/auth.validator';
import { config } from '../config/env';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;
const VERIFICATION_EXPIRY_HOURS = 24;

export async function register(req: Request, res: Response): Promise<Response> {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { email, password } = value;

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) {
    return errorResponse(res, 'Un compte existe déjà avec cette adresse email', [], 409);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email: email.toLowerCase(),
    password_hash,
    role: 'tenant',
    status: 'pending_verification',
  });

  const token = uuidv4();
  const expires_at = new Date();
  expires_at.setHours(expires_at.getHours() + VERIFICATION_EXPIRY_HOURS);
  await EmailVerificationToken.create({
    user_id: user.id,
    token,
    expires_at,
  });

  await sendVerificationEmail(user.email, token);

  return successResponse(
    res,
    {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    },
    'Email de confirmation envoyé',
    201
  );
}

export async function verifyEmail(req: Request, res: Response): Promise<Response> {
  const { error, value } = verifyEmailSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { token } = value;

  const evt = await EmailVerificationToken.findOne({ where: { token } });
  if (!evt) {
    return errorResponse(res, 'Lien invalide ou expiré', [], 400);
  }
  const user = await User.findByPk(evt.user_id);
  if (!user) {
    return errorResponse(res, 'Utilisateur introuvable', [], 400);
  }
  if (evt.used_at) {
    return errorResponse(res, 'Ce lien a déjà été utilisé', [], 400);
  }
  if (new Date() > evt.expires_at) {
    return errorResponse(res, 'Lien expiré', [], 400);
  }

  await evt.update({ used_at: new Date() });
  await user.update({
    status: 'active',
    email_verified_at: new Date(),
  });

  return successResponse(res, null, 'Email validé avec succès', 200);
}

export async function login(req: Request, res: Response): Promise<Response> {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { email, password, totp_code } = value;

  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user) {
    return errorResponse(res, 'Email ou mot de passe incorrect', [], 401);
  }
  if (user.status !== 'active') {
    return errorResponse(res, 'Compte non activé ou suspendu', [], 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return errorResponse(res, 'Email ou mot de passe incorrect', [], 401);
  }

  if (user.is_2fa_enabled) {
    if (!totp_code) {
      return successResponse(
        res,
        { requires_2fa: true, message: 'Code 2FA requis' },
        'Code 2FA requis',
        200
      );
    }
    const speakeasy = await import('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret!,
      encoding: 'base32',
      token: totp_code,
      window: 1,
    });
    if (!verified) {
      return errorResponse(res, 'Code 2FA invalide', [], 401);
    }
  }

  const refreshTokenValue = uuidv4();
  const refreshExpires = new Date();
  refreshExpires.setSeconds(refreshExpires.getSeconds() + config.jwt.refreshExpiresIn);
  await RefreshToken.create({
    user_id: user.id,
    token: refreshTokenValue,
    expires_at: refreshExpires,
  });

  await user.update({ last_login_at: new Date() });

  const access_token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return successResponse(
    res,
    {
      access_token,
      refresh_token: refreshTokenValue,
      token_type: 'Bearer',
      expires_in: config.jwt.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_2fa_enabled: user.is_2fa_enabled,
      },
    },
    'Connexion réussie',
    200
  );
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const { error, value } = refreshSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { refresh_token } = value;

  const rt = await RefreshToken.findOne({ where: { token: refresh_token } });
  if (!rt || rt.revoked_at || new Date() > rt.expires_at) {
    return errorResponse(res, 'Refresh token invalide ou expiré', [], 401);
  }
  const user = await User.findByPk(rt.user_id);
  if (!user) {
    return errorResponse(res, 'Utilisateur introuvable', [], 401);
  }

  const access_token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return successResponse(
    res,
    { access_token, expires_in: config.jwt.expiresIn },
    'Token renouvelé',
    200
  );
}

export async function logout(req: Request, res: Response): Promise<Response> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(204).send();
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as unknown as { sub: number };
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: decoded.sub } }
    );
  } catch {
    // Token invalid or expired — still return 204
  }
  return res.status(204).send();
}

export async function forgotPassword(req: Request, res: Response): Promise<Response> {
  const { error, value } = forgotPasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { email } = value;
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user) {
    return successResponse(res, null, 'Si ce compte existe, un email a été envoyé', 200);
  }
  const resetToken = uuidv4();
  const expires_at = new Date();
  expires_at.setHours(expires_at.getHours() + 1);
  await PasswordResetToken.create({
    user_id: user.id,
    token: resetToken,
    expires_at,
  });
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  if (config.env !== 'test') {
    logger.info(`Password reset link for ${user.email}: ${resetUrl}`);
  }
  return successResponse(res, null, 'Si ce compte existe, un email a été envoyé', 200);
}

export async function resetPassword(req: Request, res: Response): Promise<Response> {
  const { error, value } = resetPasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const { token, password } = value;
  const prt = await PasswordResetToken.findOne({ where: { token } });
  if (!prt || new Date() > prt.expires_at) {
    return errorResponse(res, 'Lien invalide ou expiré', [], 400);
  }
  const user = await User.findByPk(prt.user_id);
  if (!user) {
    return errorResponse(res, 'Utilisateur introuvable', [], 400);
  }
  user.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  await user.save();
  await prt.destroy();
  return successResponse(res, null, 'Mot de passe mis à jour', 200);
}

export async function enable2fa(req: Request, res: Response): Promise<Response> {
  const userModel = await User.findByPk(req.user!.id);
  if (!userModel) return errorResponse(res, 'Utilisateur introuvable', [], 404);
  if (userModel.is_2fa_enabled) {
    return errorResponse(res, '2FA déjà activé', [], 400);
  }
  const speakeasy = await import('speakeasy');
  const qrcode = await import('qrcode');
  const secret = speakeasy.generateSecret({ name: `Pouraccord (${userModel.email})` });
  await userModel.update({ totp_secret: secret.base32 });
  const qrUrl = await qrcode.toDataURL(secret.otpauth_url!);
  return successResponse(
    res,
    { qr_code_url: qrUrl, secret: secret.base32 },
    'Scannez le QR code avec votre app d\'authentification',
    200
  );
}

export async function verify2fa(req: Request, res: Response): Promise<Response> {
  const { error, value } = verify2faSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const userModel = await User.findByPk(req.user!.id);
  if (!userModel || !userModel.totp_secret) {
    return errorResponse(res, '2FA non initialisé', [], 400);
  }
  const speakeasy = await import('speakeasy');
  const valid = speakeasy.totp.verify({
    secret: userModel.totp_secret,
    encoding: 'base32',
    token: value.totp_code,
    window: 1,
  });
  if (!valid) {
    return errorResponse(res, 'Code invalide', [], 401);
  }
  await userModel.update({ is_2fa_enabled: true });
  return successResponse(res, null, '2FA activé avec succès', 200);
}

export async function disable2fa(req: Request, res: Response): Promise<Response> {
  const userModel = await User.findByPk(req.user!.id);
  if (!userModel || !userModel.is_2fa_enabled) {
    return errorResponse(res, '2FA non activé', [], 400);
  }
  await userModel.update({ is_2fa_enabled: false, totp_secret: null });
  return successResponse(res, null, '2FA désactivé', 200);
}
