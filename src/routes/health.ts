import type { FastifyInstance } from 'fastify';
import type { HealthService } from '../services/health.js';

export async function registerHealthRoutes(app: FastifyInstance, health: HealthService): Promise<void> {
  app.get('/health/live', async (_request, reply) => {
    return reply.code(200).send(health.live());
  });

  app.get('/health/ready', async (_request, reply) => {
    const report = await health.ready();
    return reply.code(report.status === 'ok' ? 200 : 503).send(report);
  });
}
