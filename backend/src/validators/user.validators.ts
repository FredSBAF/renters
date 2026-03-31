import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).trim(),
  last_name: Joi.string().min(2).max(100).trim(),
  phone: Joi.string().pattern(/^[+]?[0-9\s\-().]{7,20}$/).allow('', null),
  date_of_birth: Joi.date().iso().max('now').min('1900-01-01'),
  tenant_profile: Joi.string().valid(
    'employee_cdi',
    'employee_cdd',
    'student',
    'freelance',
    'retired',
    'other'
  ),
}).min(1);
