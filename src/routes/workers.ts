import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Logger } from 'pino';
import { authenticateRequest, requireMembership } from '../auth.js';
import type { CompanyRepository } from '../repositories/companyRepository.js';
import {
  WorkerRepository,
  type WorkerCreateInput,
  type WorkerUpdateInput,
} from '../repositories/workerRepository.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import type { SupabaseClients } from '../supabase.js';
import { WorkerRuntimeError, WorkerRuntimeService } from '../services/workerRuntime.js';
import type { CompanyBlueprint } from '../workerDomain.js';
import { autonomyLevels } from '../workerDomain.js';

const companyParams = z.object({ companyId: z.string().uuid() });
const workerParams = companyParams.extend({ workerId: z.string().uuid() });
const lessonParams = companyParams.extend({ lessonId: z.string().uuid() });
const knowledgeParams = companyParams.extend({ knowledgeId: z.string().uuid() });
const evaluationSetParams = companyParams.extend({ evaluationSetId: z.string().uuid() });
const itemParams = companyParams.extend({ itemId: z.string().uuid() });
const decisionParams = companyParams.extend({ decisionId: z.string().uuid() });
const missionParams = companyParams.extend({ missionId: z.string().uuid() });
const positiveLimit = z.coerce.number().int().min(1).max(100).default(50);
const jsonObject = z.record(z.string(), z.unknown());

const workerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  departmentId: z.string().uuid().optional(),
  description: z.string().trim().max(5000).optional(),
  avatarUrl: z.string().url().max(2000).optional(),
  personality: z.string().trim().max(5000).optional(),
  communicationConfig: jsonObject.optional(),
  providerId: z.string().uuid().optional(),
  model: z.string().trim().max(200).optional(),
  systemInstructions: z.string().trim().max(20000).optional(),
  responsibilities: z.array(z.unknown()).max(100).optional(),
  operatingPrinciples: z.array(z.unknown()).max(100).optional(),
  permissions: jsonObject.optional(),
  memoryConfig: jsonObject.optional(),
  knowledgeSources: z.array(z.unknown()).max(100).optional(),
  trainingProfile: jsonObject.optional(),
  evaluationProfile: jsonObject.optional(),
  autonomyLevel: z.enum(autonomyLevels).optional(),
  publicVisible: z.boolean().optional(),
  publicBio: z.string().trim().max(5000).optional(),
  promotionLevel: z.string().trim().max(120).optional(),
});

const workerUpdateSchema = workerSchema.partial().extend({
  changeSummary: z.string().trim().max(1000).optional(),
});
const cloneWorkerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  copyMemory: z.boolean().default(false),
});
const workerStatusSchema = z.object({
  status: z.enum(['online', 'busy', 'waiting', 'paused', 'offline', 'error', 'disabled']),
  missionId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  error: z.string().trim().max(2000).optional(),
});
const progressionSchema = z.object({
  level: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  requirements: jsonObject.default({}),
  requireCeoApproval: z.boolean().default(true),
});
const promotionSchema = z.object({
  toLevel: z.string().trim().min(1).max(120),
  toTitle: z.string().trim().max(120).optional(),
  responsibilities: z.array(z.unknown()).max(100).optional(),
  permissions: jsonObject.optional(),
  reason: z.string().trim().min(1).max(10000),
});
const lessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  lesson: z.string().trim().min(1).max(10000),
  source: z.string().trim().min(1).max(500),
  examples: z.array(z.unknown()).max(100).default([]),
  correction: z.string().trim().max(10000).optional(),
  evaluationSetId: z.string().uuid().optional(),
  actorWorkerId: z.string().uuid().optional(),
});
const reviewSchema = z.object({
  feedback: z.string().trim().min(1).max(10000),
  decision: z.enum(['approve', 'reject', 'request_changes']),
  reviewerWorkerId: z.string().uuid().optional(),
});
const knowledgeSchema = z.object({
  title: z.string().trim().min(1).max(300),
  source: z.string().trim().min(1).max(500),
  content: z.unknown(),
});
const memorySchema = z.object({
  memoryType: z.enum(['working', 'agent', 'project', 'company', 'training', 'decision']),
  title: z.string().trim().min(1).max(200),
  content: z.unknown(),
  source: z.string().trim().min(1).max(500),
  expiresAt: z.string().datetime().optional(),
});
const skillSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  instructions: z.string().trim().max(10000).default(''),
  requiredTools: z.array(z.unknown()).max(100).default([]),
  requiredPermissions: z.array(z.unknown()).max(100).default([]),
  evaluationSetId: z.string().uuid().optional(),
  compatibility: jsonObject.default({}),
});
const constitutionSchema = z.object({
  mission: z.string().trim().max(5000).default(''),
  principles: z.array(z.unknown()).max(100).default([]),
  riskTolerance: z.string().trim().max(100).default('moderate'),
  autonomyLevel: z.enum(autonomyLevels).default('observe'),
  spendingLimit: z.number().nonnegative().optional(),
  approvalRequirements: jsonObject.default({}),
  securityRules: z.array(z.unknown()).max(100).default([]),
  qualityStandards: z.array(z.unknown()).max(100).default([]),
});
const runtimeSchema = z.object({
  prompt: z.string().trim().min(1).max(50000),
  triggerType: z
    .enum(['operator', 'mission', 'task', 'evaluation', 'inbox', 'agent_review'])
    .default('operator'),
  missionId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});
const evaluationSetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).default(''),
  passThreshold: z.number().min(0).max(100).default(80),
  cases: z
    .array(
      z.object({
        prompt: z.string().trim().min(1).max(20000),
        expectedBehavior: z.array(z.unknown()).max(100).default([]),
        scoringCriteria: jsonObject.default({}),
      }),
    )
    .min(1)
    .max(100),
});
const evaluationRunSchema = z.object({ workerId: z.string().uuid() });
const templateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  requiredCapabilities: z.array(z.unknown()).max(100).default([]),
  expectedWorkflow: z.array(z.unknown()).max(100).default([]),
  tasks: z.array(z.unknown()).max(100).default([]),
  dependencies: z.array(z.unknown()).max(100).default([]),
  approvalGates: z.array(z.unknown()).max(100).default([]),
  outputArtifacts: z.array(z.unknown()).max(100).default([]),
});
const inboxSchema = z.object({
  source: z.enum(['ceo', 'telegram', 'github', 'zapier', 'webhook', 'scheduled_job', 'worker']),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  payload: jsonObject.default({}),
});
const inboxUpdateSchema = z.object({
  status: z.enum(['new', 'triaged', 'in_progress', 'completed', 'rejected']),
  workerId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
});
const decisionSchema = z.object({
  decision: z.string().trim().min(1).max(5000),
  reason: z.string().trim().max(10000).default(''),
  alternatives: z.array(z.unknown()).max(100).default([]),
  evidence: z.array(z.unknown()).max(100).default([]),
  proposedByWorkerId: z.string().uuid().optional(),
  relatedMissionId: z.string().uuid().optional(),
  relatedProjectId: z.string().uuid().optional(),
});
const decisionUpdateSchema = z.object({ status: z.enum(['approved', 'rejected']) });
const showcaseSchema = z.object({
  enabled: z.boolean(),
  description: z.string().trim().max(5000).optional(),
  industry: z.string().trim().max(200).optional(),
  mission: z.string().trim().max(5000).optional(),
  workflows: z.array(z.unknown()).max(100).default([]),
  metrics: jsonObject.default({}),
});
const cloneCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
});
const blueprintSchema = z.object({
  schemaVersion: z.literal(1),
  company: jsonObject,
  constitution: jsonObject.optional(),
  workers: z.array(jsonObject).max(100),
  skills: z.array(jsonObject).max(200),
  missionTemplates: z.array(jsonObject).max(200),
  evaluationSets: z.array(jsonObject).max(200),
});

export type WorkerRouteDependencies = {
  clients: SupabaseClients;
  companyRepository: CompanyRepository;
  productRepository: ProductRepository;
  workerRepository: WorkerRepository;
  runtime: WorkerRuntimeService;
  logger: Logger;
};

export async function registerWorkerRoutes(
  app: FastifyInstance,
  dependencies: WorkerRouteDependencies,
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
  const userId = (request: FastifyRequest): string => request.context!.user.id;

  app.get(
    '/api/v1/companies/:companyId/workers',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({ workers: await dependencies.workerRepository.listWorkers(companyId) });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = workerSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_worker', details: body.error.flatten() });
      const worker = await dependencies.workerRepository.createWorker({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      } as WorkerCreateInput);
      return reply.code(201).send({ worker });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const worker = await dependencies.workerRepository.getWorker(
        params.data.companyId,
        params.data.workerId,
      );
      if (!worker) return reply.code(404).send({ error: 'worker_not_found' });
      return reply.send({ worker });
    },
  );

  app.patch(
    '/api/v1/companies/:companyId/workers/:workerId',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = workerUpdateSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_worker', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const worker = await dependencies.workerRepository.updateWorker(
        params.data.companyId,
        params.data.workerId,
        {
          ...body.data,
          actorUserId: userId(request),
        } as WorkerUpdateInput,
      );
      return reply.send({ worker });
    },
  );

  app.patch(
    '/api/v1/companies/:companyId/workers/:workerId/status',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = workerStatusSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_status', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.workerRepository.setRuntimeStatus(
        params.data.companyId,
        params.data.workerId,
        body.data.status,
        body.data,
      );
      const worker = await dependencies.workerRepository.getWorker(
        params.data.companyId,
        params.data.workerId,
      );
      return reply.send({ worker });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/progression',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        progression: await dependencies.workerRepository.getProgression(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.put(
    '/api/v1/companies/:companyId/workers/:workerId/progression',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = progressionSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_progression', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.workerRepository.saveProgression({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.send({
        progression: await dependencies.workerRepository.getProgression(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/promote',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = promotionSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_promotion', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      try {
        const worker = await dependencies.workerRepository.promoteWorker({
          companyId: params.data.companyId,
          workerId: params.data.workerId,
          ...body.data,
          actorUserId: userId(request),
        });
        return reply.send({ worker });
      } catch (error) {
        if (error instanceof Error) return reply.code(409).send({ error: error.message });
        throw error;
      }
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/clone',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = cloneWorkerSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_clone', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const worker = await dependencies.workerRepository.cloneWorker({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        name: body.data.name,
        copyMemory: body.data.copyMemory,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ worker });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/fork',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = cloneWorkerSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_fork', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const worker = await dependencies.workerRepository.cloneWorker({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        name: body.data.name,
        copyMemory: body.data.copyMemory,
        actorUserId: userId(request),
        fork: true,
      });
      return reply.code(201).send({ worker });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/dna',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        dna: await dependencies.workerRepository.getWorkerDNA(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/versions',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        versions: await dependencies.workerRepository.listWorkerVersions(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/versions/:version/activate',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams
        .extend({ version: z.coerce.number().int().positive() })
        .safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_version' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const worker = await dependencies.workerRepository.activateWorkerVersion({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        version: params.data.version,
        actorUserId: userId(request),
      });
      return reply.send({ worker });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/training',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        lessons: await dependencies.workerRepository.listLessons(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/training',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = lessonSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_training_lesson', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const lesson = await dependencies.workerRepository.createLesson({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ lesson });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/training-lessons/:lessonId/review',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = lessonParams.safeParse(request.params);
      const body = reviewSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_lesson_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_training_review', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const lesson = await dependencies.workerRepository.reviewLesson({
        companyId: params.data.companyId,
        lessonId: params.data.lessonId,
        ...body.data,
        reviewerUserId: userId(request),
      });
      return reply.send({ lesson });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/training-lessons/:lessonId/activate',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = lessonParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_lesson_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const lesson = await dependencies.workerRepository.activateLesson({
        companyId: params.data.companyId,
        lessonId: params.data.lessonId,
        actorUserId: userId(request),
      });
      return reply.send({ lesson });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/knowledge',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        knowledge: await dependencies.workerRepository.listKnowledge(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/knowledge',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = knowledgeSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_knowledge', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const knowledge = await dependencies.workerRepository.createKnowledge({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ knowledge });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/knowledge/:knowledgeId/approve',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = knowledgeParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_knowledge_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.workerRepository.approveKnowledge({
        companyId: params.data.companyId,
        knowledgeId: params.data.knowledgeId,
        actorUserId: userId(request),
      });
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/memory',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        memory: await dependencies.workerRepository.listMemory(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/memory',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = memorySchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_worker_memory', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const memory = await dependencies.workerRepository.createMemory({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ memory });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/runs',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = runtimeSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_worker_run', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      try {
        const result = await dependencies.runtime.run({
          companyId: params.data.companyId,
          workerId: params.data.workerId,
          ...body.data,
        });
        return reply.send(result);
      } catch (error) {
        if (error instanceof WorkerRuntimeError)
          return reply.code(409).send({ error: error.message });
        throw error;
      }
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/runs',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const query = z.object({ limit: positiveLimit }).safeParse(request.query);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!query.success) return reply.code(400).send({ error: 'invalid_worker_run_query' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        runs: await dependencies.workerRepository.listWorkerRuns(
          params.data.companyId,
          params.data.workerId,
          query.data.limit,
        ),
      });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/workers/:workerId/performance',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        performance: await dependencies.workerRepository.getPerformance(
          params.data.companyId,
          params.data.workerId,
        ),
      });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/skills',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({ skills: await dependencies.workerRepository.listSkills(companyId) });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/skills',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = skillSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_skill', details: body.error.flatten() });
      const skill = await dependencies.workerRepository.createSkill({ companyId, ...body.data });
      return reply.code(201).send({ skill });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/workers/:workerId/skills',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = workerParams.safeParse(request.params);
      const body = z.object({ skillId: z.string().uuid() }).safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_worker_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_skill_assignment', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      await dependencies.workerRepository.assignSkill({
        companyId: params.data.companyId,
        workerId: params.data.workerId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/companies/:companyId/evaluation-sets',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({
        evaluationSets: await dependencies.workerRepository.listEvaluationSets(companyId),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/evaluation-sets',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = evaluationSetSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_evaluation_set', details: body.error.flatten() });
      const evaluationSet = await dependencies.workerRepository.createEvaluationSet({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ evaluationSet });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/evaluation-sets/:evaluationSetId/run',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = evaluationSetParams.safeParse(request.params);
      const body = evaluationRunSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_evaluation_set_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_evaluation_run', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const evaluationSet = await dependencies.workerRepository.getEvaluationSet(
        params.data.companyId,
        params.data.evaluationSetId,
      );
      if (!evaluationSet) return reply.code(404).send({ error: 'evaluation_set_not_found' });
      const worker = await dependencies.workerRepository.getWorker(
        params.data.companyId,
        body.data.workerId,
      );
      if (!worker) return reply.code(404).send({ error: 'worker_not_found' });
      const previous = await dependencies.workerRepository.latestEvaluation(
        params.data.companyId,
        body.data.workerId,
        params.data.evaluationSetId,
      );
      const run = await dependencies.workerRepository.createEvaluationRun({
        companyId: params.data.companyId,
        workerId: body.data.workerId,
        evaluationSetId: params.data.evaluationSetId,
        actorUserId: userId(request),
      });
      const results: Array<{
        caseId: string;
        passed: boolean;
        score: number;
        output: string;
        rationale: string;
      }> = [];
      try {
        for (const evaluationCase of evaluationSet.cases) {
          const output = await dependencies.runtime.run({
            companyId: params.data.companyId,
            workerId: body.data.workerId,
            prompt: evaluationCase.prompt,
            triggerType: 'evaluation',
          });
          const score = scoreEvaluationCase(
            output.output,
            evaluationCase.expectedBehavior,
            evaluationCase.scoringCriteria,
          );
          const passed = score >= 50;
          const rationale = buildEvaluationRationale(
            evaluationCase.expectedBehavior,
            evaluationCase.scoringCriteria,
            score,
          );
          await dependencies.workerRepository.saveEvaluationCaseResult({
            runId: run.id,
            caseId: evaluationCase.id,
            passed,
            score,
            output: output.output,
            rationale,
          });
          results.push({
            caseId: evaluationCase.id,
            passed,
            score,
            output: output.output,
            rationale,
          });
        }
        const score =
          results.length > 0
            ? results.reduce((sum, result) => sum + result.score, 0) / results.length
            : 0;
        const passedCases = results.filter((result) => result.passed).length;
        const regression = {
          flagged: previous?.score !== undefined && score < previous.score,
          before: previous?.score,
          after: score,
          delta: previous?.score === undefined ? undefined : score - previous.score,
        };
        const completed = await dependencies.workerRepository.finishEvaluationRun({
          companyId: params.data.companyId,
          runId: run.id,
          score,
          passedCases,
          totalCases: results.length,
          regression,
        });
        return reply.send({ evaluationRun: completed, results });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Evaluation execution failed';
        await dependencies.workerRepository.failEvaluationRun({
          companyId: params.data.companyId,
          runId: run.id,
          error: message,
        });
        throw error;
      }
    },
  );

  app.get(
    '/api/v1/companies/:companyId/constitution',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({
        constitution: await dependencies.workerRepository.getConstitution(companyId),
      });
    },
  );

  app.put(
    '/api/v1/companies/:companyId/constitution',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = constitutionSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_constitution', details: body.error.flatten() });
      const constitution = await dependencies.workerRepository.saveConstitution({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.send({ constitution });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/mission-templates',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send({
        templates: await dependencies.workerRepository.listTemplates(companyId),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/mission-templates',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = templateSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_mission_template', details: body.error.flatten() });
      const template = await dependencies.workerRepository.createTemplate({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ template });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/inbox',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const query = z.object({ limit: positiveLimit }).safeParse(request.query);
      if (!companyId) return;
      if (!query.success) return reply.code(400).send({ error: 'invalid_inbox_query' });
      return reply.send({
        items: await dependencies.workerRepository.listInbox(companyId, query.data.limit),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/inbox',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = inboxSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_inbox_item', details: body.error.flatten() });
      const item = await dependencies.workerRepository.createInboxItem({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send({ item });
    },
  );

  app.patch(
    '/api/v1/companies/:companyId/inbox/:itemId',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = itemParams.safeParse(request.params);
      const body = inboxUpdateSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_inbox_item_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_inbox_update', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const item = await dependencies.workerRepository.triageInboxItem({
        companyId: params.data.companyId,
        itemId: params.data.itemId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.send({ item });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/decisions',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const query = z.object({ limit: positiveLimit }).safeParse(request.query);
      if (!companyId) return;
      if (!query.success) return reply.code(400).send({ error: 'invalid_decision_query' });
      return reply.send({
        decisions: await dependencies.workerRepository.listDecisions(companyId, query.data.limit),
      });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/decisions',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = decisionSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_decision', details: body.error.flatten() });
      const decision = await dependencies.workerRepository.createDecision({
        companyId,
        ...body.data,
        proposedByUserId: userId(request),
      });
      return reply.code(201).send({ decision });
    },
  );

  app.patch(
    '/api/v1/companies/:companyId/decisions/:decisionId',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = decisionParams.safeParse(request.params);
      const body = decisionUpdateSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: 'invalid_decision_id' });
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_decision_update', details: body.error.flatten() });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      const decision = await dependencies.workerRepository.approveDecision({
        companyId: params.data.companyId,
        decisionId: params.data.decisionId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.send({ decision });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/missions/:missionId/timeline',
    { preHandler: authenticate },
    async (request, reply) => {
      const params = missionParams.safeParse(request.params);
      const query = z.object({ limit: positiveLimit }).safeParse(request.query);
      if (!params.success) return reply.code(400).send({ error: 'invalid_mission_id' });
      if (!query.success) return reply.code(400).send({ error: 'invalid_timeline_query' });
      if (!requireMembership(request, reply, params.data.companyId)) return;
      return reply.send({
        timeline: await dependencies.workerRepository.listMissionActivity(
          params.data.companyId,
          params.data.missionId,
          query.data.limit,
        ),
      });
    },
  );

  app.get(
    '/api/v1/companies/:companyId/showcase',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      const company = await dependencies.companyRepository.getCompany(companyId);
      if (!company) return reply.code(404).send({ error: 'company_not_found' });
      return reply.send({
        showcase: await dependencies.workerRepository.getShowcaseBySlug(company.slug),
      });
    },
  );

  app.put(
    '/api/v1/companies/:companyId/showcase',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = showcaseSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_showcase', details: body.error.flatten() });
      await dependencies.workerRepository.updateShowcase({
        companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.send({ updated: true });
    },
  );

  app.post(
    '/api/v1/companies/:companyId/blueprint/export',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      if (!companyId) return;
      return reply.send(await dependencies.workerRepository.exportBlueprint(companyId));
    },
  );

  app.post(
    '/api/v1/companies/:companyId/blueprint/import',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = blueprintSchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply.code(400).send({ error: 'invalid_blueprint', details: body.error.flatten() });
      const imported = await dependencies.workerRepository.importBlueprint({
        companyId,
        blueprint: body.data as unknown as CompanyBlueprint,
        actorUserId: userId(request),
      });
      return reply.code(201).send(imported);
    },
  );

  app.post(
    '/api/v1/companies/:companyId/clone',
    { preHandler: authenticate },
    async (request, reply) => {
      const companyId = ensureCompany(request, reply, request.params);
      const body = cloneCompanySchema.safeParse(request.body);
      if (!companyId) return;
      if (!body.success)
        return reply
          .code(400)
          .send({ error: 'invalid_company_clone', details: body.error.flatten() });
      const cloned = await dependencies.workerRepository.cloneCompany({
        sourceCompanyId: companyId,
        ...body.data,
        actorUserId: userId(request),
      });
      return reply.code(201).send(cloned);
    },
  );
}

export async function registerPublicShowcaseRoutes(
  app: FastifyInstance,
  repository: WorkerRepository,
): Promise<void> {
  app.get('/showcase/:slug', async (request, reply) => {
    const params = z
      .object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })
      .safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_showcase_slug' });
    try {
      const showcase = await repository.getShowcaseBySlug(params.data.slug);
      if (!showcase) return reply.code(404).send({ error: 'showcase_not_found' });
      return reply.send({ showcase });
    } catch (error) {
      if (error instanceof Error && error.message === 'Supabase is not configured')
        return reply.code(503).send({ error: 'showcase_unconfigured' });
      throw error;
    }
  });
}

function scoreEvaluationCase(
  output: string,
  expectedBehavior: unknown[],
  scoringCriteria: Record<string, unknown>,
): number {
  const keywords = Array.isArray(scoringCriteria.keywords)
    ? scoringCriteria.keywords.filter((value): value is string => typeof value === 'string')
    : expectedBehavior.filter((value): value is string => typeof value === 'string');
  if (keywords.length === 0) return 0;
  const normalizedOutput = output.toLowerCase();
  const matches = keywords.filter((keyword) => {
    const terms = keyword
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((term) => term.length >= 4);
    return (
      terms.length > 0 &&
      terms.filter((term) => normalizedOutput.includes(term)).length >= Math.ceil(terms.length / 2)
    );
  }).length;
  return (matches / keywords.length) * 100;
}

function buildEvaluationRationale(
  expectedBehavior: unknown[],
  scoringCriteria: Record<string, unknown>,
  score: number,
): string {
  const criteria = Array.isArray(scoringCriteria.keywords)
    ? scoringCriteria.keywords
    : expectedBehavior;
  return `Deterministic keyword evaluation matched ${score.toFixed(0)}% of the configured criteria: ${JSON.stringify(criteria)}`;
}
