import Joi from 'joi';

export const patchMeSchema = Joi.object({
  first_name: Joi.string().max(100).allow('', null),
  last_name: Joi.string().max(100).allow('', null),
  phone: Joi.string().max(32).allow('', null),
  tenant_profile: Joi.string()
    .valid('employee_cdi', 'employee_cdd', 'student', 'freelance', 'retired', 'other')
    .allow(null),
  date_of_birth: Joi.date().iso().allow(null),
}).min(1);
