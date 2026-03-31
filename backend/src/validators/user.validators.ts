import Joi from 'joi';

const apiAdresseAddressSchema = Joi.object({
  label: Joi.string().min(3).max(255).required(),
  house_number: Joi.string().max(16).required(),
  street: Joi.string().min(2).max(255).required(),
  postcode: Joi.string().max(16).required(),
  city: Joi.string().min(2).max(120).required(),
  citycode: Joi.string().max(16).required(),
  context: Joi.string().min(2).max(255).required(),
  country: Joi.string().min(2).max(120).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  raw: Joi.object().optional(),
  source: Joi.string().valid('api-adresse').required(),
}).unknown(false);

const manualAddressSchema = Joi.object({
  label: Joi.string().min(3).max(255).required(),
  city: Joi.string().min(2).max(120).required(),
  country: Joi.string().min(2).max(120).required(),
  house_number: Joi.string().max(16).optional(),
  street: Joi.string().max(255).optional(),
  postcode: Joi.string().max(16).optional(),
  citycode: Joi.string().max(16).optional(),
  context: Joi.string().max(255).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  source: Joi.string().valid('manual').required(),
}).unknown(false);

export const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).trim(),
  last_name: Joi.string().min(2).max(100).trim(),
  phone: Joi.string().pattern(/^[+]?[0-9\s\-().]{7,20}$/).allow('', null),
  date_of_birth: Joi.date()
    .iso()
    .max(new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000))
    .min('1900-01-01')
    .messages({
      'date.max': "L'utilisateur doit avoir au moins 16 ans",
    }),
  tenant_profile: Joi.string().valid(
    'employee_cdi',
    'employee_cdd',
    'student',
    'freelance',
    'retired',
    'other'
  ),
  address: Joi.alternatives().try(apiAdresseAddressSchema, manualAddressSchema),
}).min(1);
