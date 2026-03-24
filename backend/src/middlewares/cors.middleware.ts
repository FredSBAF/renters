import cors, { CorsOptions } from 'cors';
import { config } from '../config/env';

const localhostDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (config.cors.allowedOrigins.includes(origin)) return true;
  if (config.env !== 'production' && localhostDev.test(origin)) return true;
  return false;
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isOriginAllowed(origin)) {
      callback(null, origin);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  optionsSuccessStatus: 204,
} satisfies CorsOptions);
