import Joi from 'joi';

export const uploadDocumentSchema = Joi.object({
  document_type: Joi.string().required(),
  comment: Joi.string().max(500).optional().allow('', null),
});

export const updateCommentSchema = Joi.object({
  comment: Joi.string().max(500).required(),
});
