import type { RequestContext } from './domain.js';

declare module 'fastify' {
  interface FastifyRequest {
    context?: RequestContext;
  }
}
