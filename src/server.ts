import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const runtime = await buildApp(config);

await runtime.app.listen({ host: config.host, port: config.port });
runtime.app.log.info({ host: config.host, port: config.port, telegramMode: config.telegramMode }, 'Backend started');

if (config.telegramMode === 'webhook' && config.telegramWebhookUrl) {
  await runtime.telegram.setWebhook(config.telegramWebhookUrl);
  runtime.app.log.info({ webhookUrl: config.telegramWebhookUrl }, 'Telegram webhook configured');
}

if (config.telegramMode === 'polling') {
  void runtime.telegram.startPolling((update) => runtime.commands.handleUpdate(update));
}

const shutdown = async (signal: string) => {
  runtime.app.log.info({ signal }, 'Shutdown requested');
  runtime.telegram.stopPolling();
  await runtime.app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
