import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { loadConfig } from '../src/config.js';
import { AIProviderRegistry, ProviderUnavailableError } from '../src/integrations/ai.js';
import { normalizeTelegramUpdate, TelegramClient, TelegramNotificationService } from '../src/integrations/telegram.js';

describe('integration boundaries', () => {
  it('requires the configured Telegram webhook secret', () => {
    const client = new TelegramClient(undefined, 'a-secret-value-1234', pino({ level: 'silent' }));
    expect(client.verifyWebhookSecret('a-secret-value-1234')).toBe(true);
    expect(client.verifyWebhookSecret('wrong-secret')).toBe(false);
    expect(client.verifyWebhookSecret(undefined)).toBe(false);
  });

  it('normalizes Telegram updates without inventing absent fields', () => {
    const update = normalizeTelegramUpdate({
      update_id: 17,
      message: {
        message_id: 3,
        chat: { id: 10, type: 'private' },
        from: { id: 42, first_name: 'A' },
        text: '/ping',
      },
    });
    expect(update).toEqual({
      updateId: 17,
      message: {
        messageId: 3,
        chat: { id: 10, type: 'private' },
        from: { id: 42, isBot: false, firstName: 'A', username: undefined },
        text: '/ping',
      },
    });
  });

  it('keeps Telegram notifications behind the NotificationService contract', async () => {
    const sent: string[] = [];
    const client = { isConfigured: () => true, sendMessage: async (_recipient: number | string, body: string) => { sent.push(body); } } as unknown as TelegramClient;
    const notifications = new TelegramNotificationService(client);
    expect(notifications.isConfigured()).toBe(true);
    expect((await notifications.send({ recipient: 'not-a-chat-id', body: 'hello' })).delivered).toBe(false);
    expect((await notifications.send({ recipient: '42', body: 'hello' })).delivered).toBe(true);
    expect(sent).toEqual(['hello']);
  });

  it('keeps provider identity separate and reports missing live adapters honestly', async () => {
    const config = loadConfig({ NODE_ENV: 'test', OPENAI_API_KEY: 'present-but-not-an-adapter' });
    const registry = new AIProviderRegistry(config);
    const provider = registry.get('openai');
    expect(provider.name).toBe('openai');
    expect(provider.isConfigured()).toBe(true);
    expect((await provider.healthCheck()).status).toBe('unconfigured');
    await expect(provider.generate({ model: 'gpt-test', prompt: 'hello' })).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
