import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { GitHubIntegration } from '../integrations/external.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';

const repoParams = z.object({
  companyId: z.string().uuid(),
  owner: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
});
const issueSchema = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(10000).optional(),
  labels: z.array(z.string().max(80)).max(20).optional(),
});

export async function registerGitHubRoutes(
  app: FastifyInstance,
  dependencies: {
    clients: SupabaseClients;
    companyRepository: CompanyRepository;
    github: GitHubIntegration;
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
  const authorize = (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = repoParams.safeParse(request.params);
    if (!parsed.success) {
      void reply.code(400).send({ error: 'invalid_repository_path' });
      return null;
    }
    if (!requireMembership(request, reply, parsed.data.companyId)) return null;
    return parsed.data;
  };

  app.get(
    '/api/v1/companies/:companyId/integrations/github/repos/:owner/:repository',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = authorize(request, reply);
      if (!params) return;
      if (!dependencies.github.isConfigured())
        return reply.code(503).send({ error: 'github_unconfigured' });
      try {
        return reply.send({
          repository: await dependencies.github.getRepository(params.owner, params.repository),
        });
      } catch (error) {
        return reply.code(502).send({
          error: 'github_request_failed',
          message: error instanceof Error ? error.message : 'GitHub request failed',
        });
      }
    },
  );
  app.get(
    '/api/v1/companies/:companyId/integrations/github/repos/:owner/:repository/commits',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = authorize(request, reply);
      if (!params) return;
      const query = z
        .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
        .safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid_commit_query' });
      if (!dependencies.github.isConfigured())
        return reply.code(503).send({ error: 'github_unconfigured' });
      try {
        return reply.send({
          commits: await dependencies.github.listCommits(
            params.owner,
            params.repository,
            query.data.limit,
          ),
        });
      } catch (error) {
        return reply.code(502).send({
          error: 'github_request_failed',
          message: error instanceof Error ? error.message : 'GitHub request failed',
        });
      }
    },
  );
  app.post(
    '/api/v1/companies/:companyId/integrations/github/repos/:owner/:repository/issues',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = authorize(request, reply);
      const body = issueSchema.safeParse(request.body);
      if (!params) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_issue', details: body.error.flatten() });
      if (!dependencies.github.isConfigured())
        return reply.code(503).send({ error: 'github_unconfigured' });
      try {
        return reply.code(201).send({
          issue: await dependencies.github.createIssue(params.owner, params.repository, body.data),
        });
      } catch (error) {
        return reply.code(502).send({
          error: 'github_request_failed',
          message: error instanceof Error ? error.message : 'GitHub request failed',
        });
      }
    },
  );
}
