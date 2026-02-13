import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envFileName = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const envPathFromCwd = path.resolve(process.cwd(), envFileName);
const envPathFromSrc = path.resolve(__dirname, '..', '..', envFileName);
const envPath = fs.existsSync(envPathFromCwd)
  ? envPathFromCwd
  : envPathFromSrc;
dotenv.config({ path: envPath });

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .required(),
  PORT: Joi.number().default(3001),
  FRONTEND_URL: Joi.string().uri().required(),
  API_BASE_URL: Joi.string().uri().required(),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),

  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({ 'string.min': 'JWT_SECRET doit faire au moins 32 caractères' }),
  JWT_EXPIRES_IN: Joi.number().default(86400),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),

  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('eu-west-3'),
  AWS_S3_BUCKET: Joi.string().required(),

  SENDGRID_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),
  EMAIL_FROM_NAME: Joi.string().required(),

  TOTP_SECRET_ENCRYPTION_KEY: Joi.string()
    .length(32)
    .required()
    .messages({
      'string.length':
        'TOTP_SECRET_ENCRYPTION_KEY doit faire exactement 32 caractères (AES-256)',
    }),

  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),

  AI_SERVICE_URL: Joi.string().uri().required(),
  AI_SERVICE_SECRET: Joi.string().required(),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(5),
})
  .unknown(true)
  .options({ abortEarly: false });

export function validateEnv(env: NodeJS.ProcessEnv = process.env): {
  error?: Joi.ValidationError;
  value?: Record<string, string | number>;
} {
  const { error, value } = envSchema.validate(env);
  return {
    error: error ?? undefined,
    value: value as Record<string, string | number> | undefined,
  };
}

const { error, value } = validateEnv();

if (error) {
  console.error(
    '\n❌ ERREUR CONFIGURATION — Le serveur ne peut pas démarrer :\n'
  );
  error.details.forEach((detail) => console.error(`  → ${detail.message}`));
  console.error('\nVérifiez votre fichier .env\n');
  process.exit(1);
}

const raw = value as Record<string, string | number>;

export const config = {
  env: raw.NODE_ENV as
    | 'development'
    | 'staging'
    | 'production'
    | 'test',
  port: raw.PORT as number,
  frontendUrl: raw.FRONTEND_URL as string,
  apiBaseUrl: raw.API_BASE_URL as string,
  db: {
    host: raw.DB_HOST as string,
    port: raw.DB_PORT as number,
    name: raw.DB_NAME as string,
    user: raw.DB_USER as string,
    password: raw.DB_PASSWORD as string,
  },
  jwt: {
    secret: raw.JWT_SECRET as string,
    expiresIn: raw.JWT_EXPIRES_IN as number,
    refreshSecret: raw.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN as number,
  },
  aws: {
    accessKeyId: raw.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: raw.AWS_SECRET_ACCESS_KEY as string,
    region: raw.AWS_REGION as string,
    s3Bucket: raw.AWS_S3_BUCKET as string,
  },
  email: {
    sendgridKey: raw.SENDGRID_API_KEY as string,
    from: raw.EMAIL_FROM as string,
    fromName: raw.EMAIL_FROM_NAME as string,
  },
  totp: {
    encryptionKey: raw.TOTP_SECRET_ENCRYPTION_KEY as string,
  },
  stripe: {
    secretKey: raw.STRIPE_SECRET_KEY as string,
    webhookSecret: raw.STRIPE_WEBHOOK_SECRET as string,
  },
  ai: {
    serviceUrl: raw.AI_SERVICE_URL as string,
    secret: raw.AI_SERVICE_SECRET as string,
  },
  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS as number,
    max: raw.RATE_LIMIT_MAX_REQUESTS as number,
    authMax: raw.AUTH_RATE_LIMIT_MAX as number,
  },
} as const;

export type Config = typeof config;
