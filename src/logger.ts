import pino, { type Logger } from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
        'config.*token',
        'config.*key',
        'telegramToken',
        'botToken',
        'apiKey',
      ],
      censor: '[REDACTED]',
    },
    base: {
      service: 'draken-industries-backend',
      environment: config.nodeEnv,
    },
  });
}
