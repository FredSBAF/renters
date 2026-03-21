import Joi from 'joi';

const PHONE_REGEX = /^(\+33|0)[1-9](\d{2}){4}$/;

export const inviteGuarantorSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('guarantor', 'co_tenant', 'spouse').required(),
  first_name: Joi.string().max(100).optional(),
  last_name: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(PHONE_REGEX).optional(),
});

export const uploadGuarantorDirectSchema = Joi.object({
  first_name: Joi.string().max(100).required(),
  last_name: Joi.string().max(100).required(),
  role: Joi.string().valid('guarantor', 'co_tenant', 'spouse').required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(PHONE_REGEX).optional(),
});

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),
});
