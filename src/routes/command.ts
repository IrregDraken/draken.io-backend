import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import type { AIProviderName } from '../domain.js';
import type { AIProviderRegistry } from '../integrations/ai.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';
import type { CommandService } from '../services/commandService.js';

const paramsSchema = z.object({ companyId: z.string().uuid() });
const commandSchema = z.object({
  command: z.string().trim().min(5).max(5000),
  provider: z.enum(['openai', 'anthropic', 'google-gemini', 'manus']),
  model: z.string().trim().min(1).max(120),
});

export async function registerCommandRoutes(
  app: FastifyInstance,
  dependencies: {
    clients: SupabaseClients;
    companyRepository: CompanyRepository;
    productRepository: ProductRepository;
    providers: AIProviderRegistry;
    commands: CommandService;
    logger: Logger;
  },
): Promise<void> {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) =>
    authenticateRequest(
      request,
      reply,
      dependencies.clients,
      dependencies.companyRepository,
      dependencies.logger,
    );
  app.post(
    '/api/v1/companies/:companyId/commands',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const body = commandSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_company_id' });
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_command', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const provider = dependencies.providers.get(body.data.provider as AIProviderName);
      if (!provider.isConfigured())
        return reply
          .code(503)
          .send({ error: 'ai_provider_unconfigured', provider: body.data.provider });
      try {
        return reply.code(201).send(
          await dependencies.commands.execute({
            companyId: params.data.companyId,
            actorUserId: request.context!.user.id,
            command: body.data.command,
            provider: body.data.provider as AIProviderName,
            model: body.data.model,
          }),
        );
      } catch (error) {
        return reply.code(502).send({
          error: 'command_planning_failed',
          message: error instanceof Error ? error.message : 'Command planning failed',
        });
      }
    },
  );
}
