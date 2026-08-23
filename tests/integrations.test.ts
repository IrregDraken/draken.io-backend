import { afterEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { loadConfig } from '../src/config.js';
import { AIProviderRegistry } from '../src/integrations/ai.js';
import { normalizeTelegramUpdate, TelegramClient, TelegramNotificationService } from '../src/integrations/telegram.js';

afterEach(() => vi.unstubAllGlobals());

describe('integration boundaries', () => {
  it('requires the configured Telegram webhook secret', () => {
    const client = new TelegramClient(undefined, 'a-secret-value-1234', pino({ level: 'silent' }));
    expect(client.verifyWebhookSecret('a-secret-value-1234')).toBe(true);
    expect(client.verifyWebhookSecret('wrong-secret')).toBe(false);
    expect(client.verifyWebhookSecret(undefined)).toBe(false);
  });

  it('normalizes Telegram updates without inventing absent fields', () => {
    const update = normalizeTelegramUpdate({ update_id: 17, message: { message_id: 3, chat: { id: 10, type: 'private' }, from: { id: 42, first_name: 'A' }, text: '/ping' } });
    expect(update).toEqual({ updateId: 17, message: { messageId: 3, chat: { id: 10, type: 'private' }, from: { id: 42, isBot: false, firstName: 'A', username: undefined }, text: '/ping' } });
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

  it('uses a real OpenAI adapter behind the provider interface', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'hello from provider' } }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const registry = new AIProviderRegistry(loadConfig({ NODE_ENV: 'test', OPENAI_API_KEY: 'present-for-test' }));
    const provider = registry.get('openai');
    expect(provider.name).toBe('openai');
    expect(provider.isConfigured()).toBe(true);
    expect((await provider.healthCheck()).status).toBe('ok');
    await expect(provider.generate({ model: 'gpt-test', prompt: 'hello' })).resolves.toMatchObject({ output: 'hello from provider' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
