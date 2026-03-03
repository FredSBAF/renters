import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
  }),
  password_confirmation: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Les mots de passe ne correspondent pas',
  }),
  accept_terms: Joi.boolean().valid(true).required().messages({
    'any.only': 'Vous devez accepter les conditions générales',
  }),
  accept_privacy: Joi.boolean().valid(true).required().messages({
    'any.only': 'Vous devez accepter la politique de confidentialité',
  }),
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  totp_code: Joi.string().length(6).optional(),
});

export const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
  }),
  password_confirmation: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Les mots de passe ne correspondent pas',
  }),
});

export const verify2faSchema = Joi.object({
  totp_code: Joi.string().length(6).required(),
});
