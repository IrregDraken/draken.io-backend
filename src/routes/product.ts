import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import type { SupabaseClients } from '../supabase.js';
import type { Logger } from 'pino';
import type { ToolExecutionService } from '../services/toolRegistry.js';
import type { TaskEngineService } from '../services/taskEngine.js';

const companyParams = z.object({ companyId: z.string().uuid() });
const missionParams = companyParams.extend({ missionId: z.string().uuid() });
const taskParams = companyParams.extend({ taskId: z.string().uuid() });
const priority = z.number().int().min(1).max(5).default(3);
const departmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});
const missionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  objective: z.string().trim().max(5000).optional(),
  priority,
  deadline: z.string().datetime().optional(),
  assignedAgentIds: z.array(z.string().uuid()).max(50).default([]),
});
const missionTransitionSchema = z.object({
  stage: z.enum(['created', 'planning', 'executing', 'review', 'completed', 'failed']),
  failureReason: z.string().trim().max(2000).optional(),
});
const taskSchema = z.object({
  missionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority,
  retryLimit: z.number().int().min(0).max(20).default(0),
  assigneeEmployeeId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});
const taskTransitionSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'review', 'done', 'failed', 'cancelled']),
  failureReason: z.string().trim().max(2000).optional(),
  blockedReason: z.string().trim().max(2000).optional(),
  output: z.unknown().optional(),
});
const dependencySchema = z.object({ dependsOnTaskId: z.string().uuid() });
const toolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  inputSchema: z.unknown().default({}),
  outputSchema: z.unknown().default({}),
  permissions: z.unknown().default({}),
});
const executionSchema = z.object({
  toolId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
});

export async function registerProductRoutes(
  app: FastifyInstance,
  dependencies: {
    clients: SupabaseClients;
    companyRepository: CompanyRepository;
    productRepository: ProductRepository;
    tools: ToolExecutionService;
    taskEngine: TaskEngineService;
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
  const ensureCompany = (request: FastifyRequest, reply: FastifyReply, rawParams: unknown) => {
    const parsed = companyParams.safeParse(rawParams);
    if (!parsed.success) {
      void reply.code(400).send({ error: 'invalid_company_id' });
      return null;
    }
    if (!requireMembership(request, reply, parsed.data.companyId)) return null;
    return parsed.data.companyId;
  };

  app.get(
    '/api/v1/companies/:companyId/departments',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({
        departments: await dependencies.productRepository.listDepartments(companyId),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/departments',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = departmentSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_department', details: body.error.flatten() });
      return reply.code(201).send({
        department: await dependencies.productRepository.createDepartment({
          companyId,
          ...body.data,
        }),
      });
    },
  );
  app.get(
    '/api/v1/companies/:companyId/agents',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({ agents: await dependencies.productRepository.listEmployees(companyId) });
    },
  );
  app.get(
    '/api/v1/companies/:companyId/missions',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({ missions: await dependencies.productRepository.listMissions(companyId) });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/missions',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = missionSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_mission', details: body.error.flatten() });
      return reply.code(201).send({
        mission: await dependencies.productRepository.createMission({
          companyId,
          ...body.data,
          actorUserId: request.context!.user.id,
        }),
      });
    },
  );
  app.patch(
    '/api/v1/companies/:companyId/missions/:missionId/stage',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = missionParams.safeParse(request.params);
      const body = missionTransitionSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_mission_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_mission_transition', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.productRepository.transitionMission({
        companyId: params.data.companyId,
        missionId: params.data.missionId,
        actorUserId: request.context!.user.id,
        ...body.data,
      });
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/companies/:companyId/tasks',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      const query = z.object({ missionId: z.string().uuid().optional() }).safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid_task_query' });
      return reply.send({
        tasks: await dependencies.productRepository.listTasks(companyId, query.data.missionId),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = taskSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_task', details: body.error.flatten() });
      return reply.code(201).send({
        task: await dependencies.productRepository.createTask({
          companyId,
          ...body.data,
          actorUserId: request.context!.user.id,
        }),
      });
    },
  );
  app.patch(
    '/api/v1/companies/:companyId/tasks/:taskId/status',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      const body = taskTransitionSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_task_transition', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        task: await dependencies.productRepository.transitionTask({
          companyId: params.data.companyId,
          taskId: params.data.taskId,
          actorUserId: request.context!.user.id,
          ...body.data,
        }),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks/:taskId/start',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        task: await dependencies.taskEngine.start({
          companyId: params.data.companyId,
          taskId: params.data.taskId,
          actorUserId: request.context!.user.id,
        }),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks/:taskId/retry',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      try {
        return reply.send({
          task: await dependencies.taskEngine.retry({
            companyId: params.data.companyId,
            taskId: params.data.taskId,
            actorUserId: request.context!.user.id,
          }),
        });
      } catch (error) {
        return reply
          .code(409)
          .send({ error: error instanceof Error ? error.message : 'task_retry_failed' });
      }
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks/:taskId/complete',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      const body = z.object({ output: z.unknown().optional() }).safeParse(request.body ?? {});
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!body.success) return reply.code(400).send({ error: 'invalid_task_output' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        task: await dependencies.taskEngine.complete({
          companyId: params.data.companyId,
          taskId: params.data.taskId,
          actorUserId: request.context!.user.id,
          output: body.data.output,
        }),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks/:taskId/fail',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      const body = z
        .object({ failureReason: z.string().trim().min(1).max(2000) })
        .safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_task_failure', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        task: await dependencies.taskEngine.fail({
          companyId: params.data.companyId,
          taskId: params.data.taskId,
          actorUserId: request.context!.user.id,
          failureReason: body.data.failureReason,
        }),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tasks/:taskId/dependencies',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = taskParams.safeParse(request.params);
      const body = dependencySchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_task_id' });
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_dependency', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.productRepository.addDependency({
        companyId: params.data.companyId,
        taskId: params.data.taskId,
        ...body.data,
      });
      return reply.code(201).send({ accepted: true });
    },
  );
  app.get(
    '/api/v1/companies/:companyId/activity',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      const query = z
        .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
        .safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid_activity_query' });
      return reply.send({
        activity: await dependencies.productRepository.listActivity(companyId, query.data.limit),
      });
    },
  );
  app.get(
    '/api/v1/companies/:companyId/tools',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({ tools: await dependencies.productRepository.listTools(companyId) });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tools',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = toolSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_tool', details: body.error.flatten() });
      return reply.code(201).send({
        tool: await dependencies.productRepository.createTool({ companyId, ...body.data }),
      });
    },
  );
  app.post(
    '/api/v1/companies/:companyId/tool-executions',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = executionSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_tool_execution', details: body.error.flatten() });
      return reply.code(201).send(await dependencies.tools.execute({ companyId, ...body.data }));
    },
  );
}
