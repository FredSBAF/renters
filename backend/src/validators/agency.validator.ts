import Joi from 'joi';

const PHONE_REGEX = /^(\+33|0)[1-9](\d{2}){4}$/;
const SIRET_REGEX = /^\d{14}$/;
const POSTAL_CODE_REGEX = /^\d{5}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const registerAgencySchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  siret: Joi.string().pattern(SIRET_REGEX).required().messages({
    'string.pattern.base': 'Le SIRET doit contenir exactement 14 chiffres',
  }),
  address: Joi.string().max(500).optional().allow('', null),
  city: Joi.string().max(100).optional().allow('', null),
  postal_code: Joi.string().pattern(POSTAL_CODE_REGEX).optional().allow('', null).messages({
    'string.pattern.base': 'Le code postal doit contenir 5 chiffres',
  }),
  phone: Joi.string().pattern(PHONE_REGEX).required().messages({
    'string.pattern.base': 'Le numéro de téléphone est invalide',
  }),
  owner_email: Joi.string().email().required(),
  owner_password: Joi.string().pattern(PASSWORD_REGEX).required().messages({
    'string.pattern.base':
      'Le mot de passe doit contenir 8 caractères, une majuscule, une minuscule et un chiffre',
  }),
  accept_terms: Joi.boolean().valid(true).required().messages({
    'any.only': 'Vous devez accepter les conditions générales',
  }),
  accept_privacy: Joi.boolean().valid(true).required().messages({
    'any.only': 'Vous devez accepter la politique de confidentialité',
  }),
});

export const inviteAgentSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const updateAgencySchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  address: Joi.string().max(500).optional().allow('', null),
  city: Joi.string().max(100).optional().allow('', null),
  postal_code: Joi.string().pattern(POSTAL_CODE_REGEX).optional().allow('', null).messages({
    'string.pattern.base': 'Le code postal doit contenir 5 chiffres',
  }),
  phone: Joi.string().pattern(PHONE_REGEX).optional().allow('', null).messages({
    'string.pattern.base': 'Le numéro de téléphone est invalide',
  }),
});

export const joinAgencySchema = Joi.object({
  token: Joi.string().required(),
});
