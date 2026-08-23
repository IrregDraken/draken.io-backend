import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { AuthenticatedUser, RequestContext } from './domain.js';
import { CompanyRepository } from './repositories/companyRepository.js';
import type { SupabaseClients } from './supabase.js';

export function bearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  clients: SupabaseClients,
  repository: CompanyRepository,
  logger: Logger,
): Promise<void> {
  if (!clients.auth || !clients.configured) {
    await reply.code(503).send({ error: 'authentication_unconfigured' });
    return;
  }
  const token = bearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: 'missing_bearer_token' });
    return;
  }

  const { data, error } = await clients.auth.auth.getUser(token);
  if (error || !data.user) {
    logger.warn({ error: error?.message }, 'Supabase token validation failed');
    await reply.code(401).send({ error: 'invalid_bearer_token' });
    return;
  }

  const user: AuthenticatedUser = {
    id: data.user.id,
    email: data.user.email,
    role: data.user.role,
  };
  const memberships = await repository.getMembershipsForUser(user.id);
  request.context = { user, memberships };
}

export function requireMembership(
  request: FastifyRequest,
  reply: FastifyReply,
  companyId: string,
): boolean {
  const context = request.context as RequestContext | undefined;
  if (!context) {
    void reply.code(401).send({ error: 'authentication_required' });
    return false;
  }
  if (!context.memberships.some((membership) => membership.companyId === companyId)) {
    void reply.code(403).send({ error: 'company_access_denied' });
    return false;
  }
  return true;
}
