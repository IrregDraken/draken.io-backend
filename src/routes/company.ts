import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';

const paramsSchema = z.object({ companyId: z.string().uuid() });
const eventSchema = z.object({
  eventType: z.string().min(1).max(120),
  entityType: z.string().min(1).max(120).optional(),
  entityId: z.string().uuid().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function registerCompanyRoutes(
  app: FastifyInstance,
  dependencies: { clients: SupabaseClients; repository: CompanyRepository; logger: Logger },
): Promise<void> {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticateRequest(request, reply, dependencies.clients, dependencies.repository, dependencies.logger);
  };

  app.get('/api/v1/companies/:companyId', { preHandler: authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_company_id' });
    if (!requireMembership(request, reply, params.data.companyId)) return;
    const company = await dependencies.repository.getCompany(params.data.companyId);
    if (!company) return reply.code(404).send({ error: 'company_not_found' });
    return reply.send({ company });
  });

  app.get('/api/v1/companies/:companyId/summary', { preHandler: authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_company_id' });
    if (!requireMembership(request, reply, params.data.companyId)) return;
    const summary = await dependencies.repository.getSummary(params.data.companyId);
    return reply.send({ summary });
  });

  app.post('/api/v1/companies/:companyId/events', { preHandler: authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = eventSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: 'invalid_company_id' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_event', details: body.error.flatten() });
    if (!requireMembership(request, reply, params.data.companyId)) return;
    const eventId = await dependencies.repository.appendEvent({
      companyId: params.data.companyId,
      actorUserId: request.context?.user.id,
      eventType: body.data.eventType,
      entityType: body.data.entityType,
      entityId: body.data.entityId,
      payload: body.data.payload,
    });
    return reply.code(201).send({ eventId });
  });
}
