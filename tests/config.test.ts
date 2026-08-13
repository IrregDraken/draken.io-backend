import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('defaults Telegram to disabled and keeps integrations unconfigured', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.telegramMode).toBe('disabled');
    expect(config.telegramAuthorizedUserIds).toEqual([]);
    expect(config.supabaseUrl).toBeUndefined();
  });

  it('rejects partial Supabase configuration', () => {
    expect(() => loadConfig({ SUPABASE_URL: 'https://example.supabase.co' })).toThrow(/must be configured together/);
  });

  it('rejects non-numeric Telegram IDs', () => {
    expect(() => loadConfig({ TELEGRAM_MODE: 'disabled', TELEGRAM_AUTHORIZED_USER_IDS: 'abc' })).toThrow(/numeric Telegram user IDs/);
  });

  it('requires a bot token and webhook URL for active production Telegram webhooks', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', TELEGRAM_MODE: 'webhook', TELEGRAM_BOT_TOKEN: 'token' })).toThrow(/TELEGRAM_WEBHOOK_URL/);
    expect(() => loadConfig({ NODE_ENV: 'production', TELEGRAM_MODE: 'webhook', TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_URL: 'https://example.com/hook' })).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
  });
});
