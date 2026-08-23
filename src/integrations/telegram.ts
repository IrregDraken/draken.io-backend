import type { Logger } from 'pino';
import type { ComponentHealth, NotificationService, TelegramUpdate } from '../domain.js';

const TELEGRAM_API = 'https://api.telegram.org';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type UpdateHandler = (update: TelegramUpdate) => Promise<void>;

export class TelegramNotificationService implements NotificationService {
  readonly channel = 'telegram' as const;

  constructor(private readonly client: TelegramClient) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async send(input: {
    recipient: string;
    subject?: string;
    body: string;
  }): Promise<{ delivered: boolean; detail: string }> {
    if (!/^-?\d+$/.test(input.recipient))
      return { delivered: false, detail: 'Telegram recipient must be a numeric chat ID' };
    try {
      await this.client.sendMessage(input.recipient, input.body);
      return { delivered: true, detail: 'Telegram message delivered' };
    } catch (error) {
      return {
        delivered: false,
        detail: error instanceof Error ? error.message : 'Telegram delivery failed',
      };
    }
  }
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

export class TelegramClient {
  private polling = false;

  constructor(
    private readonly token: string | undefined,
    private readonly webhookSecret: string | undefined,
    private readonly logger: Logger,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  verifyWebhookSecret(provided: string | undefined): boolean {
    if (!this.webhookSecret) return true;
    return Boolean(provided && provided === this.webhookSecret);
  }

  async healthCheck(): Promise<ComponentHealth> {
    if (!this.token)
      return { status: 'unconfigured', detail: 'TELEGRAM_BOT_TOKEN is not configured' };
    try {
      const result = await this.call<{ id: number; username?: string }>('getMe', {});
      return {
        status: 'ok',
        detail: `Telegram bot reachable${result.username ? ` as @${result.username}` : ''}`,
      };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Telegram health check failed',
      };
    }
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text });
  }

  async setWebhook(url: string): Promise<void> {
    await this.call('setWebhook', { url, secret_token: this.webhookSecret });
  }

  async deleteWebhook(): Promise<void> {
    await this.call('deleteWebhook', { drop_pending_updates: false });
  }

  async getWebhookInfo(): Promise<{
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  }> {
    return this.call('getWebhookInfo', {});
  }

  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const updates = await this.call<Array<Record<string, unknown>>>('getUpdates', {
      timeout: 25,
      ...(offset === undefined ? {} : { offset }),
      allowed_updates: ['message'],
    });
    return updates.map((update) => normalizeTelegramUpdate(update));
  }

  async startPolling(handler: UpdateHandler): Promise<void> {
    if (!this.token || this.polling) return;
    this.polling = true;
    let offset: number | undefined;
    let backoffMs = 1000;
    this.logger.info('Telegram polling started');
    try {
      while (this.polling) {
        try {
          const updates = await this.getUpdates(offset);
          backoffMs = 1000;
          for (const update of updates) {
            offset = update.updateId + 1;
            await handler(update);
          }
        } catch (error) {
          this.logger.error(
            { error: error instanceof Error ? error.message : 'unknown error' },
            'Telegram polling error',
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 30_000);
        }
      }
    } finally {
      this.logger.info('Telegram polling stopped');
    }
  }

  stopPolling(): void {
    this.polling = false;
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    if (!this.token) throw new TelegramApiError('Telegram integration is not configured');
    const response = await fetch(`${TELEGRAM_API}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
      throw new TelegramApiError(
        payload.description ?? `Telegram API request failed for ${method}`,
        response.status,
      );
    }
    return payload.result;
  }
}

export function normalizeTelegramUpdate(update: Record<string, unknown>): TelegramUpdate {
  const message = update.message as Record<string, unknown> | undefined;
  const chat = message?.chat as Record<string, unknown> | undefined;
  const from = message?.from as Record<string, unknown> | undefined;
  return {
    updateId: Number(update.update_id),
    message:
      message && chat
        ? {
            messageId: Number(message.message_id),
            chat: { id: Number(chat.id), type: String(chat.type) },
            from: from
              ? {
                  id: Number(from.id),
                  isBot: Boolean(from.is_bot),
                  firstName: typeof from.first_name === 'string' ? from.first_name : undefined,
                  username: typeof from.username === 'string' ? from.username : undefined,
                }
              : undefined,
            text: typeof message.text === 'string' ? message.text : undefined,
          }
        : undefined,
  };
}
