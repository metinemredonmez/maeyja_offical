import * as Joi from 'joi';

/**
 * Single source of truth for environment variables.
 * Anything read from process.env must be declared here, otherwise it is undocumented and unvalidated.
 */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('api'),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),

  API_URL: Joi.string().uri().required(),
  WEB_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).default(30),
  // base64, 32 bytes (openssl rand -base64 32). Encrypts TOTP secrets at rest; falls back to a key derived from JWT_ACCESS_SECRET.
  APP_ENCRYPTION_KEY: Joi.string().allow('').default(''),
  // When true, EDITOR/ADMIN/SUPER_ADMIN accounts must enable TOTP before using admin endpoints.
  MFA_REQUIRED_FOR_STAFF: Joi.boolean().default(false),

  UPLOAD_DIR: Joi.string().default('./uploads'),
  UPLOAD_PUBLIC_URL: Joi.string().uri().required(),
  UPLOAD_MAX_MB: Joi.number().min(1).default(15),

  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('MAEYJA <hello@maeyja.com>'),
  ADMIN_NOTIFY_EMAIL: Joi.string().allow('').default(''),

  IYZICO_API_KEY: Joi.string().allow('').default(''),
  IYZICO_SECRET_KEY: Joi.string().allow('').default(''),
  IYZICO_BASE_URL: Joi.string().uri().default('https://sandbox-api.iyzipay.com'),

  ONESIGNAL_APP_ID: Joi.string().allow('').default(''),
  ONESIGNAL_API_KEY: Joi.string().allow('').default(''),

  ORDER_PAYMENT_TIMEOUT_MINUTES: Joi.number().integer().min(5).default(30),
  BANK_TRANSFER_TIMEOUT_HOURS: Joi.number().integer().min(1).default(48),

  SWAGGER_ENABLED: Joi.boolean().default(false),
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),

  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
})
  // Production must be served over https and must not run with the sample secret.
  .when(Joi.object({ NODE_ENV: Joi.valid('production') }).unknown(), {
    then: Joi.object({
      API_URL: Joi.string().uri({ scheme: ['https'] }),
      WEB_URL: Joi.string().uri({ scheme: ['https'] }),
      ADMIN_URL: Joi.string().uri({ scheme: ['https'] }),
      JWT_ACCESS_SECRET: Joi.string().min(32).invalid('dev-only-access-secret-change-me-please-32chars'),
      IYZICO_BASE_URL: Joi.string().uri({ scheme: ['https'] }),
    }),
  });

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_PREFIX: string;
  TRUST_PROXY: number;
  API_URL: string;
  WEB_URL: string;
  ADMIN_URL: string;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL_DAYS: number;
  APP_ENCRYPTION_KEY: string;
  MFA_REQUIRED_FOR_STAFF: boolean;
  UPLOAD_DIR: string;
  UPLOAD_PUBLIC_URL: string;
  UPLOAD_MAX_MB: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  MAIL_FROM: string;
  ADMIN_NOTIFY_EMAIL: string;
  IYZICO_API_KEY: string;
  IYZICO_SECRET_KEY: string;
  IYZICO_BASE_URL: string;
  ONESIGNAL_APP_ID: string;
  ONESIGNAL_API_KEY: string;
  ORDER_PAYMENT_TIMEOUT_MINUTES: number;
  BANK_TRANSFER_TIMEOUT_HOURS: number;
  SWAGGER_ENABLED: boolean;
  THROTTLE_TTL_SECONDS: number;
  THROTTLE_LIMIT: number;
}
