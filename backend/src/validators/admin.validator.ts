import Joi from 'joi';

export const getUsersQuerySchema = Joi.object({
  search: Joi.string().max(100),
  role: Joi.string().valid('tenant', 'agency_owner', 'agency_agent', 'admin'),
  status: Joi.string().valid('pending_verification', 'active', 'suspended', 'deleted'),
  is_fraud_flagged: Joi.boolean(),
  agency_id: Joi.number().integer().positive(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().valid('created_at', 'last_login_at', 'email').default('created_at'),
  sort_order: Joi.string().valid('ASC', 'DESC').default('DESC'),
});

export const suspendUserSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

export const deleteUserSchema = Joi.object({
  confirm: Joi.boolean().valid(true).required(),
});

export const getMetricsQuerySchema = Joi.object({
  period: Joi.string().valid('day', 'week', 'month').default('month'),
});

export const getTimeSeriesSchema = Joi.object({
  metric: Joi.string()
    .valid('new_tenants', 'new_agencies', 'folders_verified', 'revenue', 'fraud_detected')
    .required(),
  period: Joi.string().valid('week', 'month', 'year').default('month'),
  granularity: Joi.string().valid('day', 'week', 'month').default('day'),
});

export const exportCSVSchema = Joi.object({
  type: Joi.string().valid('tenants', 'agencies', 'folders', 'revenue').required(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
});
