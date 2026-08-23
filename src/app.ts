import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync } from 'node:fs';
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
import { AuthService } from './services/authService.js';
import { registerAuthLifecycleRoutes } from './routes/authLifecycle.js';
import { ProductRepository } from './repositories/productRepository.js';
import { ToolRegistry, ToolExecutionService } from './services/toolRegistry.js';
import { registerProductRoutes } from './routes/product.js';
import { TaskEngineService } from './services/taskEngine.js';
import { registerGitHubRoutes } from './routes/github.js';
import { CommandService } from './services/commandService.js';
import { registerCommandRoutes } from './routes/command.js';

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
  const productRepository = new ProductRepository(clients.admin);
  const authService = new AuthService(clients);
  const toolRegistry = new ToolRegistry();
  const toolExecutionService = new ToolExecutionService(productRepository, toolRegistry, logger);
  const taskEngine = new TaskEngineService(productRepository, logger);
  const telegram = new TelegramClient(config.telegramBotToken, config.telegramWebhookSecret, logger);
  const providers = new AIProviderRegistry(config);
  const commandService = new CommandService(providers, productRepository);
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
  await app.register(rateLimit, { max: config.rateLimitMax, timeWindow: config.rateLimitWindow });
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
  await registerAuthLifecycleRoutes(app, { auth: authService, clients, repository, logger });
  await registerCompanyRoutes(app, { clients, repository, logger });
  await registerResourceRoutes(app, { clients, repository, logger });
  await registerProductRoutes(app, { clients, companyRepository: repository, productRepository, tools: toolExecutionService, taskEngine, logger });
  await registerGitHubRoutes(app, { clients, companyRepository: repository, github: external.github, logger });
  await registerCommandRoutes(app, { clients, companyRepository: repository, productRepository, providers, commands: commandService, logger });
  await registerTelegramRoutes(app, { client: telegram, commands });
  const webRoot = path.resolve(config.webDir);
  if (existsSync(path.join(webRoot, 'index.html'))) {
    await app.register(fastifyStatic, { root: webRoot, wildcard: false, index: false });
    app.get('/', async (_request, reply) => reply.sendFile('index.html'));
    app.get('/*', async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/health/') || request.url.startsWith('/integrations/')) return reply.code(404).send({ error: 'not_found' });
      return reply.sendFile('index.html');
    });
  }

  return { app, telegram, commands, health };
}
