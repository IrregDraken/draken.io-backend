import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const csvUserIds = z.preprocess(
  emptyToUndefined,
  z.string().transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (!/^\d+$/.test(part)) {
          throw new Error('TELEGRAM_AUTHORIZED_USER_IDS must contain only numeric Telegram user IDs');
        }
        return Number(part);
      }),
  ).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
  ZAPIER_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DOCKER_SANDBOX_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  MANUS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
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
  zapierWebhookUrl?: string;
  dockerSandboxUrl?: string;
  providerKeys: Record<string, string | undefined>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  const hasAnySupabase = Boolean(parsed.SUPABASE_URL || parsed.SUPABASE_ANON_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY);
  const hasAllSupabase = Boolean(parsed.SUPABASE_URL && parsed.SUPABASE_ANON_KEY && parsed.SUPABASE_SERVICE_ROLE_KEY);
  if (hasAnySupabase && !hasAllSupabase) {
    throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be configured together');
  }
  if (parsed.TELEGRAM_MODE !== 'disabled' && !parsed.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required when TELEGRAM_MODE is not disabled');
  }
  if (parsed.TELEGRAM_MODE === 'webhook' && !parsed.TELEGRAM_WEBHOOK_URL) {
    throw new Error('TELEGRAM_WEBHOOK_URL is required when TELEGRAM_MODE=webhook');
  }
  if (parsed.NODE_ENV === 'production' && parsed.TELEGRAM_MODE === 'webhook' && !parsed.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required for production Telegram webhooks');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    corsOrigins: parsed.CORS_ORIGINS ? parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean) : [],
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
    zapierWebhookUrl: parsed.ZAPIER_WEBHOOK_URL,
    dockerSandboxUrl: parsed.DOCKER_SANDBOX_URL,
    providerKeys: {
      openai: parsed.OPENAI_API_KEY,
      anthropic: parsed.ANTHROPIC_API_KEY,
      googleGemini: parsed.GOOGLE_GEMINI_API_KEY,
      manus: parsed.MANUS_API_KEY,
    },
  };
}
