import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';

const paramsSchema = z.object({ companyId: z.string().uuid(), resource: z.string().min(1).max(80) });

export async function registerResourceRoutes(
  app: FastifyInstance,
  dependencies: { clients: SupabaseClients; repository: CompanyRepository; logger: Logger },
): Promise<void> {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticateRequest(request, reply, dependencies.clients, dependencies.repository, dependencies.logger);
  };

  app.get('/api/v1/companies/:companyId/resources/:resource', { preHandler: authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_resource_request' });
    if (!requireMembership(request, reply, params.data.companyId)) return;
    try {
      const records = await dependencies.repository.listResource(params.data.companyId, params.data.resource);
      return reply.send({ resource: params.data.resource, records });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unsupported company resource')) {
        return reply.code(404).send({ error: 'unsupported_company_resource' });
      }
      throw error;
    }
  });
}
