import type { Logger } from 'pino';
import type { CompanySummary, HealthReport, TelegramUpdate } from '../domain.js';
import { TelegramClient } from '../integrations/telegram.js';
import { CompanyRepository } from '../repositories/companyRepository.js';

export type HealthProvider = () => Promise<HealthReport>;

export class TelegramCommandService {
  constructor(
    private readonly client: TelegramClient,
    private readonly repository: CompanyRepository,
    private readonly authorizedUserIds: number[],
    private readonly getHealth: HealthProvider,
    private readonly logger: Logger,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    const from = message?.from;
    const text = message?.text?.trim();
    if (!message || !from || !text) return;

    if (!this.authorizedUserIds.includes(from.id)) {
      await this.client.sendMessage(message.chat.id, 'This bot is private. Your Telegram account is not authorized.');
      this.logger.warn({ telegramUserId: from.id }, 'Rejected unauthorized Telegram user');
      return;
    }

    const membership = await this.repository.getTelegramMembership(from.id);
    if (!membership) {
      await this.client.sendMessage(message.chat.id, 'Your Telegram account is allow-listed but is not mapped to an active company membership.');
      this.logger.warn({ telegramUserId: from.id }, 'Rejected Telegram user without active company mapping');
      return;
    }

    const command = text.split(/\s+/u)[0]?.split('@')[0]?.toLowerCase();
    switch (command) {
      case '/start':
        await this.client.sendMessage(message.chat.id, `Connected to ${membership.companyName}. Use /help to see available commands.`);
        return;
      case '/help':
        await this.client.sendMessage(message.chat.id, '/start — connect to the company bot\n/help — list commands\n/ping — check Telegram connectivity\n/status — show real backend health and company state');
        return;
      case '/ping':
        await this.client.sendMessage(message.chat.id, 'pong');
        return;
      case '/status': {
        const [health, summary] = await Promise.all([this.getHealth(), this.repository.getSummary(membership.companyId)]);
        await this.client.sendMessage(message.chat.id, formatStatus(health, summary));
        return;
      }
      default:
        await this.client.sendMessage(message.chat.id, 'Unknown command. Use /help.');
    }
  }
}

function formatStatus(health: HealthReport, summary: CompanySummary): string {
  const componentLines = Object.entries(health.components).map(([name, component]) => `${name}: ${component.status}${component.detail ? ` (${component.detail})` : ''}`);
  return [
    `Backend: ${health.status}`,
    ...componentLines,
    `Company: ${summary.companyId}`,
    `Employees: ${summary.counts.employees}`,
    `Missions: ${summary.counts.missions}`,
    `Projects: ${summary.counts.projects}`,
    `Tasks: ${summary.counts.tasks}`,
    `Channels: ${summary.counts.channels}`,
    `Messages: ${summary.counts.messages}`,
    `Notifications: ${summary.counts.notifications}`,
    `Recent events: ${summary.recentEvents.length}`,
  ].join('\n');
}
