import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import type { Config } from './config.js';
import { createLogger } from './logger.js';
import { createSupabaseClients } from './supabase.js';
import { CompanyRepository } from './repositories/companyRepository.js';
import { AIProviderRegistry } from './integrations/ai.js';
import { createExternalIntegrations } from './integrations/external.js';
import { TelegramClient } from './integrations/telegram.js';
import { HealthService } from './services/health.js';
import { TelegramCommandService } from './services/telegramService.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCompanyRoutes } from './routes/company.js';
import { registerResourceRoutes } from './routes/resources.js';
import { registerTelegramRoutes } from './routes/telegram.js';

export type Runtime = {
  app: FastifyInstance;
  telegram: TelegramClient;
  commands: TelegramCommandService;
  health: HealthService;
};

export async function buildApp(config: Config): Promise<Runtime> {
  const logger = createLogger(config);
  const clients = createSupabaseClients(config);
  const repository = new CompanyRepository(clients.admin);
  const telegram = new TelegramClient(config.telegramBotToken, config.telegramWebhookSecret, logger);
  const providers = new AIProviderRegistry(config);
  const external = createExternalIntegrations(config);
  const health = new HealthService(clients, telegram, providers, external, logger);
  const commands = new TelegramCommandService(telegram, repository, config.telegramAuthorizedUserIds, () => health.ready(), logger);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie'],
    },
  });
  await app.register(helmet);
  await app.register(sensible);
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: config.corsOrigins.length > 0,
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled request error');
    if (reply.sent) return;
    return reply.code(500).send({ error: 'internal_server_error' });
  });

  await registerHealthRoutes(app, health);
  await registerAuthRoutes(app, { clients, repository, logger });
  await registerCompanyRoutes(app, { clients, repository, logger });
  await registerResourceRoutes(app, { clients, repository, logger });
  await registerTelegramRoutes(app, { client: telegram, commands });

  return { app, telegram, commands, health };
}
