import Joi from 'joi';

export const resolveItemSchema = Joi.object({
  resolution: Joi.string().valid('approved', 'rejected', 'fraud_confirmed').required(),
  admin_notes: Joi.string().max(2000).optional().allow('', null),
  adjusted_score: Joi.number().min(0).max(100).optional(),
});

export const requestMoreInfoSchema = Joi.object({
  message: Joi.string().min(10).max(1000).required(),
});

export const getModerationQueueSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_review', 'validated', 'rejected').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
});
