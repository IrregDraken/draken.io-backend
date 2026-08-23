import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const csvUserIds = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          if (!/^\d+$/.test(part)) {
            throw new Error(
              'TELEGRAM_AUTHORIZED_USER_IDS must contain only numeric Telegram user IDs',
            );
          }
          return Number(part);
        }),
    )
    .optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  WEB_DIR: z.preprocess(emptyToUndefined, z.string().default('public')),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  CORS_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_AUTHORIZED_USER_IDS: csvUserIds,
  TELEGRAM_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  TELEGRAM_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  TELEGRAM_MODE: z.enum(['polling', 'webhook', 'disabled']).default('disabled'),
  GITHUB_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  RESEND_FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  ZAPIER_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DOCKER_SANDBOX_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DOCKER_SANDBOX_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_API_BASE: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  MANUS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  publicAppUrl?: string;
  webDir: string;
  rateLimitMax: number;
  rateLimitWindow: string;
  corsOrigins: string[];
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  telegramBotToken?: string;
  telegramAuthorizedUserIds: number[];
  telegramWebhookSecret?: string;
  telegramWebhookUrl?: string;
  telegramMode: 'polling' | 'webhook' | 'disabled';
  githubToken?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  zapierWebhookUrl?: string;
  dockerSandboxUrl?: string;
  dockerSandboxToken?: string;
  providerKeys: Record<string, string | undefined>;
  providerBaseUrls: Record<string, string | undefined>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  const hasAnySupabase = Boolean(
    parsed.SUPABASE_URL || parsed.SUPABASE_ANON_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY,
  );
  const hasAllSupabase = Boolean(
    parsed.SUPABASE_URL && parsed.SUPABASE_ANON_KEY && parsed.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (hasAnySupabase && !hasAllSupabase) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be configured together',
    );
  }
  if (parsed.TELEGRAM_MODE !== 'disabled' && !parsed.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required when TELEGRAM_MODE is not disabled');
  }
  if (parsed.TELEGRAM_MODE === 'webhook' && !parsed.TELEGRAM_WEBHOOK_URL) {
    throw new Error('TELEGRAM_WEBHOOK_URL is required when TELEGRAM_MODE=webhook');
  }
  if (
    parsed.NODE_ENV === 'production' &&
    parsed.TELEGRAM_MODE === 'webhook' &&
    !parsed.TELEGRAM_WEBHOOK_SECRET
  ) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required for production Telegram webhooks');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    publicAppUrl: parsed.PUBLIC_APP_URL,
    webDir: parsed.WEB_DIR,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindow: parsed.RATE_LIMIT_WINDOW,
    corsOrigins: parsed.CORS_ORIGINS
      ? parsed.CORS_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : [],
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseAnonKey: parsed.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    telegramAuthorizedUserIds: parsed.TELEGRAM_AUTHORIZED_USER_IDS ?? [],
    telegramWebhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET,
    telegramWebhookUrl: parsed.TELEGRAM_WEBHOOK_URL,
    telegramMode: parsed.TELEGRAM_MODE,
    githubToken: parsed.GITHUB_TOKEN,
    resendApiKey: parsed.RESEND_API_KEY,
    resendFromEmail: parsed.RESEND_FROM_EMAIL,
    zapierWebhookUrl: parsed.ZAPIER_WEBHOOK_URL,
    dockerSandboxUrl: parsed.DOCKER_SANDBOX_URL,
    dockerSandboxToken: parsed.DOCKER_SANDBOX_TOKEN,
    providerKeys: {
      openai: parsed.OPENAI_API_KEY,
      anthropic: parsed.ANTHROPIC_API_KEY,
      googleGemini: parsed.GOOGLE_GEMINI_API_KEY,
      manus: parsed.MANUS_API_KEY,
    },
    providerBaseUrls: { openai: parsed.OPENAI_API_BASE },
  };
}
