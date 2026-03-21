import Joi from 'joi';

export const getNotificationsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  unread_only: Joi.boolean().default(false),
});

export const updatePreferencesSchema = Joi.object({
  email_enabled: Joi.boolean(),
  inapp_enabled: Joi.boolean(),
  email_document_expiring: Joi.boolean(),
  email_document_expired: Joi.boolean(),
  email_folder_complete: Joi.boolean(),
  email_folder_verified: Joi.boolean(),
  email_folder_viewed: Joi.boolean(),
  email_folder_document_downloaded: Joi.boolean(),
  email_new_folder_shared: Joi.boolean(),
  email_subscription_alerts: Joi.boolean(),
  weekly_digest_enabled: Joi.boolean(),
  weekly_digest_day: Joi.number().integer().min(0).max(6),
}).min(1);
