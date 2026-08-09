import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Like `required`, but the fallback is a *development* convenience only.
 *
 * These values sign JWTs. A committed default that silently applies in
 * production would let anyone who can read this repository mint an admin access
 * token, so production must fail to boot rather than start with a known secret.
 * The length floor exists because a short HMAC secret is brute-forceable
 * offline from a single captured token.
 */
function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];

  if (!isProduction) {
    return value ?? devFallback;
  }

  if (!value) {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  if (value === devFallback) {
    throw new Error(`${name} is still set to its development default — set a unique secret.`);
  }
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production.`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',

  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/medishift'),

  jwt: {
    accessSecret: requiredSecret('JWT_ACCESS_SECRET', 'dev_access_secret'),
    refreshSecret: requiredSecret('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  cookieSecret: requiredSecret('COOKIE_SECRET', 'dev_cookie_secret'),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'MediShift <no-reply@medishift.com>',
  },

  redisUrl: process.env.REDIS_URL ?? '',

  schedulingService: {
    url: process.env.SCHEDULING_SERVICE_URL ?? 'http://localhost:8000',
    apiKey: process.env.SCHEDULING_SERVICE_API_KEY ?? '',
  },
};
