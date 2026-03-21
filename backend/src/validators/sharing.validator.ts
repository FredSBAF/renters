import Joi from 'joi';

export const createSharingLinkSchema = Joi.object({
  context: Joi.object({
    property_type: Joi.string().max(10).optional(),
    city: Joi.string().max(100).optional(),
    budget: Joi.number().min(0).max(100000).optional(),
    availability: Joi.string().isoDate().optional(),
    listing_ref: Joi.string().max(100).optional(),
  }).optional(),
});

export const consultFolderSchema = Joi.object({
  email: Joi.string().email().optional(),
});

export const trackDownloadSchema = Joi.object({
  document_id: Joi.number().required(),
  link_id: Joi.string().guid({ version: ['uuidv4'] }).required(),
});
