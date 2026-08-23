import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { bearerToken, authenticateRequest } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';
import type { AuthService } from '../services/authService.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(120).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/u)
    .optional(),
});
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/u)
    .optional(),
  avatarUrl: z.string().url().optional(),
});

export async function registerAuthLifecycleRoutes(
  app: FastifyInstance,
  dependencies: {
    auth: AuthService;
    clients: SupabaseClients;
    repository: CompanyRepository;
    logger: Logger;
  },
): Promise<void> {
  app.post('/api/v1/auth/signup', async (request, reply) => {
    const body = signupSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'invalid_signup', details: body.error.flatten() });
    try {
      return reply.code(201).send(await dependencies.auth.signUp(body.data));
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = credentialsSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'invalid_credentials', details: body.error.flatten() });
    try {
      return reply.send(await dependencies.auth.signIn(body.data));
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = bearerToken(request);
    if (!token) return reply.code(401).send({ error: 'missing_bearer_token' });
    try {
      await dependencies.auth.signOut(token);
      return reply.code(204).send();
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/api/v1/auth/password-reset', async (request, reply) => {
    const body = z
      .object({ email: z.string().email(), redirectTo: z.string().url().optional() })
      .safeParse(request.body);
    if (!body.success)
      return reply
        .code(400)
        .send({ error: 'invalid_password_reset_request', details: body.error.flatten() });
    try {
      await dependencies.auth.requestPasswordReset(body.data.email, body.data.redirectTo);
      return reply.send({ accepted: true });
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.get(
    '/api/v1/auth/session',
    {
      preHandler: async (request, reply) =>
        authenticateRequest(
          request,
          reply,
          dependencies.clients,
          dependencies.repository,
          dependencies.logger,
        ),
    },
    async (request, reply) => {
      const token = bearerToken(request);
      if (!token) return reply.code(401).send({ error: 'missing_bearer_token' });
      try {
        return reply.send({ user: await dependencies.auth.getSession(token) });
      } catch (error) {
        return authError(reply, error);
      }
    },
  );

  app.patch(
    '/api/v1/auth/profile',
    {
      preHandler: async (request, reply) =>
        authenticateRequest(
          request,
          reply,
          dependencies.clients,
          dependencies.repository,
          dependencies.logger,
        ),
    },
    async (request, reply) => {
      const token = bearerToken(request);
      const body = profileSchema.safeParse(request.body);
      if (!token) return reply.code(401).send({ error: 'missing_bearer_token' });
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_profile', details: body.error.flatten() });
      try {
        return reply.send({ profile: await dependencies.auth.updateProfile(token, body.data) });
      } catch (error) {
        return authError(reply, error);
      }
    },
  );
}

function authError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : 'Authentication operation failed';
  if (message === 'authentication_unconfigured') return reply.code(503).send({ error: message });
  return reply.code(401).send({ error: 'authentication_failed', message });
}
