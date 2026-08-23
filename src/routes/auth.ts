import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticateRequest } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: { clients: SupabaseClients; repository: CompanyRepository; logger: Logger },
): Promise<void> {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticateRequest(
      request,
      reply,
      dependencies.clients,
      dependencies.repository,
      dependencies.logger,
    );
  };

  app.get('/api/v1/me', { preHandler: authenticate }, async (request, reply) => {
    if (!request.context) return reply.code(401).send({ error: 'authentication_required' });
    return reply.send({ user: request.context.user, memberships: request.context.memberships });
  });
}
