import Joi from 'joi';

export const updateFolderStatusSchema = Joi.object({
  folder_status: Joi.string().valid('active', 'standby', 'archived').required(),
});

export const getRequiredDocsSchema = Joi.object({
  profile: Joi.string()
    .valid('employee_cdi', 'employee_cdd', 'student', 'freelance', 'retired', 'other')
    .optional(),
});
