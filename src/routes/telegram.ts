import type { FastifyInstance } from 'fastify';
import { normalizeTelegramUpdate, TelegramClient } from '../integrations/telegram.js';
import type { TelegramCommandService } from '../services/telegramService.js';

export async function registerTelegramRoutes(
  app: FastifyInstance,
  dependencies: { client: TelegramClient; commands: TelegramCommandService },
): Promise<void> {
  app.post('/integrations/telegram/webhook', async (request, reply) => {
    const header = request.headers['x-telegram-bot-api-secret-token'];
    const secret = Array.isArray(header) ? header[0] : header;
    if (!dependencies.client.verifyWebhookSecret(secret)) {
      return reply.code(401).send({ error: 'invalid_telegram_webhook_secret' });
    }
    if (!request.body || typeof request.body !== 'object') {
      return reply.code(400).send({ error: 'invalid_telegram_update' });
    }
    await dependencies.commands.handleUpdate(normalizeTelegramUpdate(request.body as Record<string, unknown>));
    return reply.code(200).send({ ok: true });
  });
}
