import { describe, expect, it } from 'vitest';
import type { HealthReport } from '../src/domain.js';
import { TelegramClient } from '../src/integrations/telegram.js';
import { CompanyRepository } from '../src/repositories/companyRepository.js';
import { TelegramCommandService } from '../src/services/telegramService.js';

const health: HealthReport = {
  status: 'unconfigured',
  service: 'draken-industries-backend',
  checkedAt: '2026-08-14T00:00:00.000Z',
  components: { database: { status: 'unconfigured', detail: 'not configured' } },
};

function fixture() {
  const sent: string[] = [];
  const client = {
    sendMessage: async (_chatId: number, text: string) => {
      sent.push(text);
    },
  } as unknown as TelegramClient;
  const repository = {
    getTelegramMembership: async (id: number) =>
      id === 42
        ? { companyId: 'company-1', companyName: 'Draken Industries', membershipRole: 'owner' }
        : null,
    getSummary: async () => ({
      companyId: 'company-1',
      counts: {
        employees: 0,
        missions: 0,
        projects: 0,
        tasks: 0,
        channels: 0,
        messages: 0,
        notifications: 0,
      },
      recentEvents: [],
    }),
  } as unknown as CompanyRepository;
  const service = new TelegramCommandService(
    client,
    repository,
    [42, 7],
    async () => health,
    console as never,
  );
  return { sent, service };
}

describe('TelegramCommandService', () => {
  it('rejects user IDs outside the explicit allow-list', async () => {
    const { sent, service } = fixture();
    await service.handleUpdate({
      updateId: 1,
      message: {
        messageId: 1,
        chat: { id: 9, type: 'private' },
        from: { id: 99 },
        text: '/status',
      },
    });
    expect(sent[0]).toContain('not authorized');
  });

  it('rejects allow-listed users without an active company mapping', async () => {
    const { sent, service } = fixture();
    await service.handleUpdate({
      updateId: 2,
      message: { messageId: 1, chat: { id: 9, type: 'private' }, from: { id: 7 }, text: '/ping' },
    });
    expect(sent[0]).toContain('not mapped');
  });

  it('handles supported commands and reports real zero-state counts', async () => {
    const { sent, service } = fixture();
    for (const [index, command] of ['/start', '/help', '/ping', '/status'].entries()) {
      await service.handleUpdate({
        updateId: index + 3,
        message: {
          messageId: index + 1,
          chat: { id: 9, type: 'private' },
          from: { id: 42 },
          text: command,
        },
      });
    }
    expect(sent[0]).toContain('Draken Industries');
    expect(sent[1]).toContain('/status');
    expect(sent[2]).toBe('pong');
    expect(sent[3]).toContain('Employees: 0');
    expect(sent[3]).toContain('Missions: 0');
  });
});
