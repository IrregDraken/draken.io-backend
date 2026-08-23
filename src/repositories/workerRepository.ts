import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CompanyBlueprint,
  CompanyConstitution,
  CompanyInboxItem,
  CompanyShowcase,
  Decision,
  EvaluationCase,
  EvaluationRun,
  EvaluationSet,
  LessonStatus,
  MissionTemplate,
  Skill,
  TrainingLesson,
  TrainingReview,
  Worker,
  WorkerMemory,
  WorkerPerformance,
  WorkerRun,
  WorkerRuntimeContext,
  WorkerStatus,
  WorkerVersion,
} from '../workerDomain.js';
import { autonomyLevels, lessonStatuses, workerStatuses } from '../workerDomain.js';
import { sanitizeJson, sanitizeRecord } from '../security.js';

type Row = Record<string, unknown>;

type WorkerExtras = {
  runtime: Map<string, Row>;
  skills: Map<string, Skill[]>;
  providers: Map<string, string>;
  departments: Map<string, string>;
};

export type WorkerCreateInput = {
  companyId: string;
  name: string;
  title?: string;
  role?: string;
  department?: string;
  departmentId?: string;
  description?: string;
  avatarUrl?: string;
  personality?: string;
  communicationConfig?: Record<string, unknown>;
  providerId?: string;
  model?: string;
  systemInstructions?: string;
  responsibilities?: unknown[];
  operatingPrinciples?: unknown[];
  permissions?: Record<string, unknown>;
  memoryConfig?: Record<string, unknown>;
  knowledgeSources?: unknown[];
  trainingProfile?: Record<string, unknown>;
  evaluationProfile?: Record<string, unknown>;
  autonomyLevel?: Worker['autonomyLevel'];
  publicVisible?: boolean;
  publicBio?: string;
  promotionLevel?: string;
  parentWorkerId?: string;
  actorUserId: string;
};

export type WorkerUpdateInput = Partial<
  Omit<WorkerCreateInput, 'companyId' | 'name' | 'actorUserId'>
> & {
  name?: string;
  changeSummary?: string;
  actorUserId: string;
};

export type WorkerRepositoryPort = {
  getWorker(companyId: string, workerId: string): Promise<Worker | null>;
  getRuntimeContext(companyId: string, workerId: string): Promise<WorkerRuntimeContext>;
  createWorkerRun(input: {
    companyId: string;
    workerId: string;
    workerVersionId?: string;
    missionId?: string;
    taskId?: string;
    providerKey?: string;
    model?: string;
    triggerType: string;
    prompt: string;
    contextSummary: Record<string, unknown>;
  }): Promise<WorkerRun>;
  finishWorkerRun(
    companyId: string,
    runId: string,
    result: { status: 'completed' | 'failed' | 'cancelled'; output?: string; error?: string },
  ): Promise<WorkerRun>;
  setRuntimeStatus(
    companyId: string,
    workerId: string,
    status: WorkerStatus,
    details?: { missionId?: string; taskId?: string; error?: string },
  ): Promise<void>;
};

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRow(value) ? value : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requireAdmin(admin?: SupabaseClient): SupabaseClient {
  if (!admin) throw new Error('Supabase is not configured');
  return admin;
}

function normalizeAutonomy(value: unknown): Worker['autonomyLevel'] {
  return autonomyLevels.includes(value as Worker['autonomyLevel'])
    ? (value as Worker['autonomyLevel'])
    : 'observe';
}

function normalizeWorkerStatus(value: unknown): WorkerStatus {
  if (workerStatuses.includes(value as WorkerStatus)) return value as WorkerStatus;
  if (value === 'available') return 'online';
  if (value === 'away') return 'waiting';
  return value === 'disabled' ? 'disabled' : 'offline';
}

function normalizeLessonStatus(value: unknown): LessonStatus {
  return lessonStatuses.includes(value as LessonStatus) ? (value as LessonStatus) : 'proposed';
}

export class WorkerRepository implements WorkerRepositoryPort {
  constructor(private readonly admin?: SupabaseClient) {}

  async listWorkers(companyId: string): Promise<Worker[]> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .order('display_name');
    if (error) throw error;
    const workerRows = rows(data);
    const extras = await this.loadWorkerExtras(companyId, workerRows);
    return workerRows.map((row) => this.worker(row, extras));
  }

  async getWorker(companyId: string, workerId: string): Promise<Worker | null> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', workerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const extras = await this.loadWorkerExtras(companyId, [data as Row]);
    return this.worker(data as Row, extras);
  }

  async createWorker(input: WorkerCreateInput): Promise<Worker> {
    const client = requireAdmin(this.admin);
    await this.ensureDepartment(input.companyId, input.departmentId);
    await this.ensureProvider(input.companyId, input.providerId);
    if (input.parentWorkerId) await this.ensureWorker(input.companyId, input.parentWorkerId);
    const { data, error } = await client
      .from('employees')
      .insert({
        company_id: input.companyId,
        display_name: input.name,
        title: input.title ?? null,
        role: input.role ?? null,
        department: input.department ?? null,
        department_id: input.departmentId ?? null,
        description: input.description ?? null,
        avatar_url: input.avatarUrl ?? null,
        personality: input.personality ?? null,
        communication_config: input.communicationConfig ?? {},
        ai_provider_id: input.providerId ?? null,
        model: input.model ?? null,
        system_instructions: input.systemInstructions ?? null,
        responsibilities: input.responsibilities ?? [],
        operating_principles: input.operatingPrinciples ?? [],
        permissions: input.permissions ?? {},
        memory_config: input.memoryConfig ?? {},
        knowledge_sources: input.knowledgeSources ?? [],
        training_profile: input.trainingProfile ?? {},
        evaluation_profile: input.evaluationProfile ?? {},
        autonomy_level: input.autonomyLevel ?? 'observe',
        public_visible: input.publicVisible ?? false,
        public_bio: input.publicBio ?? null,
        promotion_level: input.promotionLevel ?? null,
        parent_employee_id: input.parentWorkerId ?? null,
        status: 'offline',
      })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as Row;
    const workerId = String(row.id);
    await client.from('worker_runtime_states').upsert({
      employee_id: workerId,
      company_id: input.companyId,
      status: 'offline',
    });
    await client.from('worker_progressions').upsert({
      employee_id: workerId,
      company_id: input.companyId,
      level: input.promotionLevel ?? 'base',
      title: input.title ?? input.role ?? null,
    });
    await this.createVersionSnapshot(input.companyId, workerId, 1, input.actorUserId, {
      ...this.snapshotFromInput(input),
      name: input.name,
    });
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      workerId,
      'worker.created',
      `${input.name} was hired`,
      {},
    );
    return (await this.getWorker(input.companyId, workerId)) as Worker;
  }

  async updateWorker(
    companyId: string,
    workerId: string,
    input: WorkerUpdateInput,
  ): Promise<Worker> {
    const current = await this.getWorker(companyId, workerId);
    if (!current) throw new Error('Worker not found');
    const client = requireAdmin(this.admin);
    await this.ensureDepartment(companyId, input.departmentId);
    await this.ensureProvider(companyId, input.providerId);
    const patch: Row = {};
    const assign = (key: string, value: unknown) => {
      if (value !== undefined) patch[key] = value;
    };
    assign('display_name', input.name);
    assign('title', input.title);
    assign('role', input.role);
    assign('department', input.department);
    assign('department_id', input.departmentId);
    assign('description', input.description);
    assign('avatar_url', input.avatarUrl);
    assign('personality', input.personality);
    assign('communication_config', input.communicationConfig);
    assign('ai_provider_id', input.providerId);
    assign('model', input.model);
    assign('system_instructions', input.systemInstructions);
    assign('responsibilities', input.responsibilities);
    assign('operating_principles', input.operatingPrinciples);
    assign('permissions', input.permissions);
    assign('memory_config', input.memoryConfig);
    assign('knowledge_sources', input.knowledgeSources);
    assign('training_profile', input.trainingProfile);
    assign('evaluation_profile', input.evaluationProfile);
    assign('autonomy_level', input.autonomyLevel);
    assign('public_visible', input.publicVisible);
    assign('public_bio', input.publicBio);
    assign('promotion_level', input.promotionLevel);
    if (Object.keys(patch).length === 0) return current;
    const nextVersion = current.version + 1;
    patch.version = nextVersion;
    const { error } = await client
      .from('employees')
      .update(patch)
      .eq('company_id', companyId)
      .eq('id', workerId);
    if (error) throw error;
    await this.createVersionSnapshot(
      companyId,
      workerId,
      nextVersion,
      input.actorUserId,
      this.snapshotFromWorker({
        ...current,
        ...this.patchToWorker(current, input),
        version: nextVersion,
      }),
      input.changeSummary ?? 'Worker configuration updated',
      current.version,
    );
    await this.recordActivity(
      companyId,
      input.actorUserId,
      workerId,
      'worker.updated',
      `${current.name} configuration updated`,
      {
        version: nextVersion,
      },
    );
    return (await this.getWorker(companyId, workerId)) as Worker;
  }

  async cloneWorker(input: {
    companyId: string;
    workerId: string;
    name: string;
    copyMemory?: boolean;
    actorUserId: string;
    fork?: boolean;
  }): Promise<Worker> {
    const source = await this.getWorker(input.companyId, input.workerId);
    if (!source) throw new Error('Source worker not found');
    const cloned = await this.createWorker({
      companyId: input.companyId,
      name: input.name,
      title: source.title,
      role: source.role,
      department: source.department,
      departmentId: source.departmentId,
      description: source.description,
      avatarUrl: source.avatarUrl,
      personality: source.personality,
      communicationConfig: source.communicationConfig,
      providerId: source.providerId,
      model: source.model,
      systemInstructions: source.systemInstructions,
      responsibilities: source.responsibilities,
      operatingPrinciples: source.operatingPrinciples,
      permissions: source.permissions,
      memoryConfig: source.memoryConfig,
      knowledgeSources: source.knowledgeSources,
      trainingProfile: source.trainingProfile,
      evaluationProfile: source.evaluationProfile,
      autonomyLevel: source.autonomyLevel,
      publicVisible: false,
      publicBio: undefined,
      promotionLevel: source.promotionLevel,
      parentWorkerId: input.workerId,
      actorUserId: input.actorUserId,
    });
    const client = requireAdmin(this.admin);
    const { data: links, error: linksError } = await client
      .from('worker_skills')
      .select('skill_id')
      .eq('employee_id', input.workerId);
    if (linksError) throw linksError;
    const skillIds = rows(links)
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string');
    if (skillIds.length > 0) {
      const { error } = await client.from('worker_skills').insert(
        skillIds.map((skillId) => ({
          employee_id: cloned.id,
          skill_id: skillId,
          assigned_by_user_id: input.actorUserId,
        })),
      );
      if (error) throw error;
    }
    const { data: lessons, error: lessonError } = await client
      .from('training_lessons')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('employee_id', input.workerId)
      .in('status', ['approved', 'active']);
    if (lessonError) throw lessonError;
    if (rows(lessons).length > 0) {
      const { error } = await client.from('training_lessons').insert(
        rows(lessons).map((row) => ({
          company_id: input.companyId,
          employee_id: cloned.id,
          title: row.title,
          category: row.category,
          lesson: row.lesson,
          source: `cloned from worker ${input.workerId}`,
          examples: row.examples ?? [],
          correction: row.correction ?? null,
          created_by_user_id: input.actorUserId,
          status: 'proposed',
          version: Number(row.version ?? 1),
          evaluation_set_id: row.evaluation_set_id ?? null,
        })),
      );
      if (error) throw error;
    }
    if (input.copyMemory) {
      const { data: memories, error: memoryError } = await client
        .from('worker_memory')
        .select('*')
        .eq('company_id', input.companyId)
        .eq('employee_id', input.workerId)
        .eq('approved', true)
        .in('memory_type', ['training', 'company', 'project']);
      if (memoryError) throw memoryError;
      if (rows(memories).length > 0) {
        const { error } = await client.from('worker_memory').insert(
          rows(memories).map((row) => ({
            company_id: input.companyId,
            employee_id: cloned.id,
            memory_type: row.memory_type,
            title: row.title,
            content: row.content,
            source: `explicitly copied from worker ${input.workerId}`,
            approved: false,
            created_by_user_id: input.actorUserId,
          })),
        );
        if (error) throw error;
      }
    }
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      cloned.id,
      input.fork ? 'worker.forked' : 'worker.cloned',
      `${source.name} became ${cloned.name}`,
      {
        parentWorkerId: input.workerId,
        memoryCopied: Boolean(input.copyMemory),
      },
    );
    return (await this.getWorker(input.companyId, cloned.id)) as Worker;
  }

  async getWorkerDNA(
    companyId: string,
    workerId: string,
  ): Promise<import('../workerDomain.js').WorkerDNA> {
    const worker = await this.getWorker(companyId, workerId);
    if (!worker) throw new Error('Worker not found');
    const lessons = await this.listLessons(companyId, workerId);
    const evaluationSetIds = Array.isArray(worker.evaluationProfile.evaluationSetIds)
      ? worker.evaluationProfile.evaluationSetIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    return {
      id: worker.id,
      name: worker.name,
      version: worker.version,
      title: worker.title,
      role: worker.role,
      provider: worker.providerKey,
      model: worker.model,
      skills: worker.skills.map((skill) => ({ name: skill.name, version: skill.version })),
      operatingPrincipleCount: worker.operatingPrinciples.length,
      knowledgeSourceCount: worker.knowledgeSources.length,
      trainingLessonCount: lessons.length,
      evaluationSetCount: evaluationSetIds.length,
      permissionKeys: Object.keys(worker.permissions),
      autonomyLevel: worker.autonomyLevel,
    };
  }

  async listWorkerVersions(companyId: string, workerId: string): Promise<WorkerVersion[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_versions')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .order('version', { ascending: false });
    if (error) throw error;
    return rows(data).map((row) => this.workerVersion(row));
  }

  async activateWorkerVersion(input: {
    companyId: string;
    workerId: string;
    version: number;
    actorUserId: string;
  }): Promise<Worker> {
    const client = requireAdmin(this.admin);
    const { data: versionRow, error: versionError } = await client
      .from('worker_versions')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('employee_id', input.workerId)
      .eq('version', input.version)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!versionRow) throw new Error('Worker version not found');
    const snapshot = recordValue((versionRow as Row).snapshot);
    const patch: Row = {
      display_name: snapshot.name ?? snapshot.displayName,
      title: snapshot.title ?? null,
      role: snapshot.role ?? null,
      description: snapshot.description ?? null,
      personality: snapshot.personality ?? null,
      communication_config: snapshot.communicationConfig ?? {},
      system_instructions: snapshot.systemInstructions ?? null,
      responsibilities: snapshot.responsibilities ?? [],
      operating_principles: snapshot.operatingPrinciples ?? [],
      permissions: snapshot.permissions ?? {},
      memory_config: snapshot.memoryConfig ?? {},
      knowledge_sources: snapshot.knowledgeSources ?? [],
      training_profile: snapshot.trainingProfile ?? {},
      evaluation_profile: snapshot.evaluationProfile ?? {},
      autonomy_level: normalizeAutonomy(snapshot.autonomyLevel),
      version: input.version,
    };
    const { error: workerError } = await client
      .from('employees')
      .update(patch)
      .eq('company_id', input.companyId)
      .eq('id', input.workerId);
    if (workerError) throw workerError;
    await client
      .from('worker_versions')
      .update({ status: 'archived' })
      .eq('company_id', input.companyId)
      .eq('employee_id', input.workerId)
      .neq('version', input.version);
    const { error: activateError } = await client
      .from('worker_versions')
      .update({
        status: 'active',
        activated_by_user_id: input.actorUserId,
        activated_at: new Date().toISOString(),
      })
      .eq('company_id', input.companyId)
      .eq('employee_id', input.workerId)
      .eq('version', input.version);
    if (activateError) throw activateError;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      input.workerId,
      'worker.version_deployed',
      `Worker version ${input.version} deployed`,
      {
        version: input.version,
      },
    );
    return (await this.getWorker(input.companyId, input.workerId)) as Worker;
  }

  async listSkills(companyId: string): Promise<Skill[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('skills')
      .select('*')
      .eq('company_id', companyId)
      .order('name')
      .order('version', { ascending: false });
    if (error) throw error;
    return rows(data).map((row) => this.skill(row));
  }

  async createSkill(input: {
    companyId: string;
    name: string;
    description: string;
    instructions: string;
    requiredTools: unknown[];
    requiredPermissions: unknown[];
    evaluationSetId?: string;
    compatibility: Record<string, unknown>;
  }): Promise<Skill> {
    const { data, error } = await requireAdmin(this.admin)
      .from('skills')
      .insert({
        company_id: input.companyId,
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        required_tools: input.requiredTools,
        required_permissions: input.requiredPermissions,
        evaluation_set_id: input.evaluationSetId ?? null,
        compatibility: input.compatibility,
        status: 'active',
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.skill(data as Row);
  }

  async assignSkill(input: {
    companyId: string;
    workerId: string;
    skillId: string;
    actorUserId: string;
  }): Promise<void> {
    const client = requireAdmin(this.admin);
    const worker = await this.getWorker(input.companyId, input.workerId);
    if (!worker) throw new Error('Worker not found');
    const { data: skill, error: skillError } = await client
      .from('skills')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('id', input.skillId)
      .maybeSingle();
    if (skillError) throw skillError;
    if (!skill) throw new Error('Skill not found');
    const { error } = await client.from('worker_skills').upsert({
      employee_id: input.workerId,
      skill_id: input.skillId,
      assigned_by_user_id: input.actorUserId,
    });
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      input.workerId,
      'worker.skill_assigned',
      `Skill assigned to ${worker.name}`,
      {
        skillId: input.skillId,
      },
    );
  }

  async listLessons(companyId: string, workerId: string): Promise<TrainingLesson[]> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('training_lessons')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const lessonRows = rows(data);
    const ids = lessonRows.map((row) => String(row.id));
    const reviewsByLesson = new Map<string, TrainingReview>();
    if (ids.length > 0) {
      const { data: reviews, error: reviewError } = await client
        .from('training_reviews')
        .select('*')
        .eq('company_id', companyId)
        .in('lesson_id', ids)
        .order('created_at', { ascending: false });
      if (reviewError) throw reviewError;
      for (const row of rows(reviews)) {
        const lessonId = String(row.lesson_id);
        if (!reviewsByLesson.has(lessonId)) reviewsByLesson.set(lessonId, this.trainingReview(row));
      }
    }
    return lessonRows.map((row) => this.trainingLesson(row, reviewsByLesson.get(String(row.id))));
  }

  async createLesson(input: {
    companyId: string;
    workerId: string;
    title: string;
    category: string;
    lesson: string;
    source: string;
    examples: unknown[];
    correction?: string;
    evaluationSetId?: string;
    actorUserId: string;
    actorWorkerId?: string;
  }): Promise<TrainingLesson> {
    await this.ensureWorker(input.companyId, input.workerId);
    const { data, error } = await requireAdmin(this.admin)
      .from('training_lessons')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        title: input.title,
        category: input.category,
        lesson: input.lesson,
        source: input.source,
        examples: input.examples,
        correction: input.correction ?? null,
        evaluation_set_id: input.evaluationSetId ?? null,
        created_by_user_id: input.actorUserId,
        created_by_employee_id: input.actorWorkerId ?? null,
        status: 'proposed',
      })
      .select('*')
      .single();
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      input.workerId,
      'training.lesson_proposed',
      `Training lesson proposed: ${input.title}`,
      {},
    );
    return this.trainingLesson(data as Row);
  }

  async reviewLesson(input: {
    companyId: string;
    lessonId: string;
    feedback: string;
    decision: TrainingReview['decision'];
    reviewerUserId: string;
    reviewerWorkerId?: string;
  }): Promise<TrainingLesson> {
    const client = requireAdmin(this.admin);
    const { data: lesson, error: lessonError } = await client
      .from('training_lessons')
      .select('id, employee_id, title, status')
      .eq('company_id', input.companyId)
      .eq('id', input.lessonId)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) throw new Error('Training lesson not found');
    const status =
      input.decision === 'approve'
        ? 'approved'
        : input.decision === 'reject'
          ? 'rejected'
          : 'reviewing';
    const { error: reviewError } = await client.from('training_reviews').insert({
      company_id: input.companyId,
      lesson_id: input.lessonId,
      reviewer_user_id: input.reviewerUserId,
      reviewer_employee_id: input.reviewerWorkerId ?? null,
      feedback: input.feedback,
      decision: input.decision,
    });
    if (reviewError) throw reviewError;
    const { data, error } = await client
      .from('training_lessons')
      .update({ status })
      .eq('company_id', input.companyId)
      .eq('id', input.lessonId)
      .select('*')
      .single();
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.reviewerUserId,
      String((lesson as Row).employee_id),
      'training.lesson_reviewed',
      `Training lesson ${status}`,
      {
        lessonId: input.lessonId,
        decision: input.decision,
      },
    );
    return this.trainingLesson(data as Row);
  }

  async activateLesson(input: {
    companyId: string;
    lessonId: string;
    actorUserId: string;
  }): Promise<TrainingLesson> {
    const client = requireAdmin(this.admin);
    const { data: existing, error: findError } = await client
      .from('training_lessons')
      .select('status, employee_id, title')
      .eq('company_id', input.companyId)
      .eq('id', input.lessonId)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) throw new Error('Training lesson not found');
    if (existing.status !== 'approved') throw new Error('Only approved lessons can become active');
    const { data, error } = await client
      .from('training_lessons')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('company_id', input.companyId)
      .eq('id', input.lessonId)
      .select('*')
      .single();
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      String((existing as Row).employee_id),
      'training.lesson_activated',
      `Training lesson activated: ${String((existing as Row).title)}`,
      {
        lessonId: input.lessonId,
      },
    );
    return this.trainingLesson(data as Row);
  }

  async listKnowledge(
    companyId: string,
    workerId: string,
  ): Promise<import('../workerDomain.js').WorkerKnowledge[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_knowledge')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rows(data).map((row) => ({
      id: String(row.id),
      workerId: String(row.employee_id),
      title: String(row.title),
      source: String(row.source),
      content: row.content,
      status: String(row.status) as import('../workerDomain.js').WorkerKnowledge['status'],
      createdAt: String(row.created_at),
      approvedAt: optionalString(row.approved_at),
    }));
  }

  async createKnowledge(input: {
    companyId: string;
    workerId: string;
    title: string;
    source: string;
    content: unknown;
    actorUserId: string;
  }): Promise<import('../workerDomain.js').WorkerKnowledge> {
    await this.ensureWorker(input.companyId, input.workerId);
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_knowledge')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        title: input.title,
        source: input.source,
        content: input.content,
        status: 'proposed',
        created_by_user_id: input.actorUserId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return {
      id: String((data as Row).id),
      workerId: String((data as Row).employee_id),
      title: String((data as Row).title),
      source: String((data as Row).source),
      content: (data as Row).content,
      status: 'proposed',
      createdAt: String((data as Row).created_at),
    };
  }

  async approveKnowledge(input: {
    companyId: string;
    knowledgeId: string;
    actorUserId: string;
  }): Promise<void> {
    const { error } = await requireAdmin(this.admin)
      .from('worker_knowledge')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('company_id', input.companyId)
      .eq('id', input.knowledgeId)
      .eq('status', 'proposed');
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      undefined,
      'training.knowledge_approved',
      'Worker knowledge approved',
      { knowledgeId: input.knowledgeId },
    );
  }

  async listMemory(companyId: string, workerId: string): Promise<WorkerMemory[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_memory')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rows(data).map((row) => this.memory(row));
  }

  async createMemory(input: {
    companyId: string;
    workerId: string;
    memoryType: WorkerMemory['memoryType'];
    title: string;
    content: unknown;
    source: string;
    actorUserId: string;
    expiresAt?: string;
  }): Promise<WorkerMemory> {
    await this.ensureWorker(input.companyId, input.workerId);
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_memory')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        memory_type: input.memoryType,
        title: input.title,
        content: input.content,
        source: input.source,
        approved: false,
        created_by_user_id: input.actorUserId,
        expires_at: input.expiresAt ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.memory(data as Row);
  }

  async getConstitution(companyId: string): Promise<CompanyConstitution | null> {
    const { data, error } = await requireAdmin(this.admin)
      .from('company_constitutions')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? this.constitution(data as Row) : null;
  }

  async saveConstitution(input: {
    companyId: string;
    mission: string;
    principles: unknown[];
    riskTolerance: string;
    autonomyLevel: Worker['autonomyLevel'];
    spendingLimit?: number;
    approvalRequirements: Record<string, unknown>;
    securityRules: unknown[];
    qualityStandards: unknown[];
    actorUserId: string;
  }): Promise<CompanyConstitution> {
    const client = requireAdmin(this.admin);
    const current = await this.getConstitution(input.companyId);
    const version = (current?.version ?? 0) + 1;
    if (current) {
      const { error } = await client
        .from('company_constitutions')
        .update({ status: 'archived' })
        .eq('company_id', input.companyId)
        .eq('id', current.id);
      if (error) throw error;
    }
    const { data, error } = await client
      .from('company_constitutions')
      .insert({
        company_id: input.companyId,
        version,
        mission: input.mission,
        principles: input.principles,
        risk_tolerance: input.riskTolerance,
        autonomy_level: input.autonomyLevel,
        spending_limit: input.spendingLimit ?? null,
        approval_requirements: input.approvalRequirements,
        security_rules: input.securityRules,
        quality_standards: input.qualityStandards,
        status: 'active',
        created_by_user_id: input.actorUserId,
        activated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      undefined,
      'constitution.updated',
      `Company constitution v${version} activated`,
      { version },
    );
    return this.constitution(data as Row);
  }

  async getRuntimeContext(companyId: string, workerId: string): Promise<WorkerRuntimeContext> {
    const worker = await this.getWorker(companyId, workerId);
    if (!worker) throw new Error('Worker not found');
    const client = requireAdmin(this.admin);
    const [constitution, lessons, knowledge, memory, toolLinks] = await Promise.all([
      this.getConstitution(companyId),
      this.listLessons(companyId, workerId),
      client
        .from('worker_knowledge')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('status', 'active'),
      client
        .from('worker_memory')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(100),
      client.from('employee_tools').select('tool_id').eq('employee_id', workerId),
    ]);
    if (knowledge.error) throw knowledge.error;
    if (memory.error) throw memory.error;
    if (toolLinks.error) throw toolLinks.error;
    return {
      worker: {
        id: worker.id,
        name: worker.name,
        title: worker.title,
        role: worker.role,
        description: worker.description,
        personality: worker.personality,
        responsibilities: worker.responsibilities,
        operatingPrinciples: worker.operatingPrinciples,
        autonomyLevel: worker.autonomyLevel,
        version: worker.version,
      },
      provider: { key: worker.providerKey, model: worker.model },
      constitution: constitution
        ? {
            mission: constitution.mission,
            principles: constitution.principles,
            riskTolerance: constitution.riskTolerance,
            autonomyLevel: constitution.autonomyLevel,
            approvalRequirements: constitution.approvalRequirements,
            securityRules: constitution.securityRules,
            qualityStandards: constitution.qualityStandards,
          }
        : undefined,
      skills: worker.skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        requiredTools: skill.requiredTools,
      })),
      tools: await this.loadRuntimeTools(
        companyId,
        rows(toolLinks.data).map((row) => String(row.tool_id)),
      ),
      lessons: lessons
        .filter((lesson) => lesson.status === 'active')
        .map((lesson) => ({
          title: lesson.title,
          category: lesson.category,
          lesson: lesson.lesson,
          correction: lesson.correction,
          examples: lesson.examples,
        })),
      knowledge: rows(knowledge.data).map((row) => ({
        title: String(row.title),
        source: String(row.source),
        content: sanitizeJson(row.content),
      })),
      memory: rows(memory.data).map((row) => ({
        memoryType: String(row.memory_type) as WorkerMemory['memoryType'],
        title: String(row.title),
        content: sanitizeJson(row.content),
        source: String(row.source),
      })),
      permissions: sanitizeRecord(worker.permissions),
    };
  }

  private async loadRuntimeTools(
    companyId: string,
    toolIds: string[],
  ): Promise<Array<{ name: string; description: string }>> {
    if (toolIds.length === 0) return [];
    const { data, error } = await requireAdmin(this.admin)
      .from('tools')
      .select('name, description')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .in('id', toolIds);
    if (error) throw error;
    return rows(data).map((row) => ({
      name: String(row.name),
      description: String(row.description),
    }));
  }

  async createWorkerRun(input: {
    companyId: string;
    workerId: string;
    workerVersionId?: string;
    missionId?: string;
    taskId?: string;
    providerKey?: string;
    model?: string;
    triggerType: string;
    prompt: string;
    contextSummary: Record<string, unknown>;
  }): Promise<WorkerRun> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_runs')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        worker_version_id: input.workerVersionId ?? null,
        mission_id: input.missionId ?? null,
        task_id: input.taskId ?? null,
        provider_key: input.providerKey ?? null,
        model: input.model ?? null,
        trigger_type: input.triggerType,
        prompt: input.prompt,
        context_summary: input.contextSummary,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.workerRun(data as Row);
  }

  async finishWorkerRun(
    companyId: string,
    runId: string,
    result: { status: 'completed' | 'failed' | 'cancelled'; output?: string; error?: string },
  ): Promise<WorkerRun> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_runs')
      .update({
        status: result.status,
        output: result.output ?? null,
        error: result.error ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('id', runId)
      .select('*')
      .single();
    if (error) throw error;
    return this.workerRun(data as Row);
  }

  async setRuntimeStatus(
    companyId: string,
    workerId: string,
    status: WorkerStatus,
    details: { missionId?: string; taskId?: string; error?: string } = {},
  ): Promise<void> {
    const { error } = await requireAdmin(this.admin)
      .from('worker_runtime_states')
      .upsert({
        employee_id: workerId,
        company_id: companyId,
        status,
        current_mission_id: details.missionId ?? null,
        current_task_id: details.taskId ?? null,
        last_active_at: new Date().toISOString(),
        error: details.error ?? null,
      });
    if (error) throw error;
    const legacyStatus =
      status === 'online'
        ? 'available'
        : status === 'waiting' || status === 'paused' || status === 'error'
          ? 'away'
          : status;
    const { error: employeeError } = await requireAdmin(this.admin)
      .from('employees')
      .update({ status: legacyStatus })
      .eq('company_id', companyId)
      .eq('id', workerId);
    if (employeeError) throw employeeError;
  }

  async listWorkerRuns(companyId: string, workerId: string, limit = 50): Promise<WorkerRun[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_runs')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return rows(data).map((row) => this.workerRun(row));
  }

  async getProgression(
    companyId: string,
    workerId: string,
  ): Promise<{
    level: string;
    title?: string;
    requirements: Record<string, unknown>;
    requireCeoApproval: boolean;
  } | null> {
    const { data, error } = await requireAdmin(this.admin)
      .from('worker_progressions')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Row;
    return {
      level: String(row.level),
      title: optionalString(row.title),
      requirements: recordValue(row.requirements),
      requireCeoApproval: booleanValue(row.require_ceo_approval, true),
    };
  }

  async saveProgression(input: {
    companyId: string;
    workerId: string;
    level: string;
    title?: string;
    requirements: Record<string, unknown>;
    requireCeoApproval: boolean;
    actorUserId: string;
  }): Promise<void> {
    await this.ensureWorker(input.companyId, input.workerId);
    const { error } = await requireAdmin(this.admin)
      .from('worker_progressions')
      .upsert({
        employee_id: input.workerId,
        company_id: input.companyId,
        level: input.level,
        title: input.title ?? null,
        requirements: input.requirements,
        require_ceo_approval: input.requireCeoApproval,
      });
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      input.workerId,
      'worker.progression_updated',
      `Progression updated for worker ${input.workerId}`,
      { level: input.level },
    );
  }

  async promoteWorker(input: {
    companyId: string;
    workerId: string;
    toLevel: string;
    toTitle?: string;
    responsibilities?: unknown[];
    permissions?: Record<string, unknown>;
    reason: string;
    actorUserId: string;
  }): Promise<Worker> {
    const worker = await this.getWorker(input.companyId, input.workerId);
    if (!worker) throw new Error('Worker not found');
    const progression = await this.getProgression(input.companyId, input.workerId);
    const performance = await this.getPerformance(input.companyId, input.workerId);
    const requirements = progression?.requirements ?? {};
    const evaluationThreshold = optionalNumber(requirements.evaluationThreshold);
    if (
      evaluationThreshold !== undefined &&
      (performance.evaluationScore ?? 0) < evaluationThreshold
    )
      throw new Error(
        `Worker evaluation score does not meet the ${evaluationThreshold}% promotion threshold`,
      );
    const missionCount = optionalNumber(requirements.missionCount);
    if (missionCount !== undefined && performance.missionsCompleted < missionCount)
      throw new Error(`Worker has not completed the ${missionCount} required missions`);
    const skillCount = optionalNumber(requirements.skillCount);
    if (skillCount !== undefined && worker.skills.length < skillCount)
      throw new Error(`Worker does not have the ${skillCount} required skills`);
    const updated = await this.updateWorker(input.companyId, input.workerId, {
      title: input.toTitle ?? worker.title,
      responsibilities: input.responsibilities ?? worker.responsibilities,
      permissions: input.permissions ?? worker.permissions,
      promotionLevel: input.toLevel,
      changeSummary: `Promoted to ${input.toLevel}`,
      actorUserId: input.actorUserId,
    });
    const { error } = await requireAdmin(this.admin)
      .from('worker_promotions')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        from_level: worker.promotionLevel ?? progression?.level ?? null,
        to_level: input.toLevel,
        from_title: worker.title ?? null,
        to_title: input.toTitle ?? worker.title ?? null,
        reason: input.reason,
        requirements_snapshot: requirements,
        approved_by_user_id: input.actorUserId,
      });
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      input.workerId,
      'worker.promoted',
      `${worker.name} promoted to ${input.toLevel}`,
      {
        fromLevel: worker.promotionLevel ?? progression?.level,
        toLevel: input.toLevel,
      },
    );
    return updated;
  }

  async getPerformance(companyId: string, workerId: string): Promise<WorkerPerformance> {
    const client = requireAdmin(this.admin);
    const [
      missions,
      assigned,
      tasks,
      toolFailures,
      corrections,
      regressions,
      lessons,
      improvements,
      evaluations,
    ] = await Promise.all([
      client
        .from('missions')
        .select('id')
        .eq('company_id', companyId)
        .eq('owner_employee_id', workerId)
        .eq('status', 'completed'),
      client.from('mission_agents').select('mission_id').eq('employee_id', workerId),
      client
        .from('tasks')
        .select('id, status, started_at, completed_at')
        .eq('company_id', companyId)
        .eq('assignee_employee_id', workerId),
      client
        .from('tool_executions')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('status', 'failed'),
      client
        .from('training_lessons')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .not('created_by_user_id', 'is', null),
      client
        .from('evaluation_runs')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('regression->>flagged', 'true'),
      client
        .from('training_lessons')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', workerId),
      client
        .from('training_lessons')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('status', 'active'),
      client
        .from('evaluation_runs')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', workerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
    ]);
    for (const result of [
      missions,
      assigned,
      tasks,
      toolFailures,
      corrections,
      regressions,
      lessons,
      improvements,
      evaluations,
    ]) {
      if (result.error) throw result.error;
    }
    const taskRows = rows(tasks.data);
    const doneTasks = taskRows.filter((row) => row.status === 'done');
    const successfulTasks = doneTasks.length;
    const failedTasks = taskRows.filter((row) => row.status === 'failed').length;
    const durations = doneTasks
      .map((row) => {
        const start = Date.parse(String(row.started_at ?? ''));
        const end = Date.parse(String(row.completed_at ?? ''));
        return Number.isFinite(start) && Number.isFinite(end) && end >= start
          ? end - start
          : undefined;
      })
      .filter((value): value is number => value !== undefined);
    const evaluationRows = rows(evaluations.data);
    const latestEvaluation = evaluationRows[0] ? this.evaluationRun(evaluationRows[0]) : undefined;
    const assignedMissionIds = new Set(rows(assigned.data).map((row) => String(row.mission_id)));
    const ownedCompleted = rows(missions.data).length;
    const assignedCompleted =
      assignedMissionIds.size > 0
        ? ((
            await client
              .from('missions')
              .select('id')
              .eq('company_id', companyId)
              .eq('status', 'completed')
              .in('id', [...assignedMissionIds])
          ).data?.length ?? 0)
        : 0;
    return {
      missionsCompleted: ownedCompleted + assignedCompleted,
      tasksCompleted: successfulTasks,
      taskSuccessRate:
        successfulTasks + failedTasks > 0
          ? (successfulTasks / (successfulTasks + failedTasks)) * 100
          : undefined,
      evaluationScore: latestEvaluation?.score,
      averageTaskDurationMs:
        durations.length > 0
          ? durations.reduce((sum, value) => sum + value, 0) / durations.length
          : undefined,
      toolFailures: rows(toolFailures.data).length,
      humanCorrections: rows(corrections.data).length,
      regressionEvents: rows(regressions.data).length,
      approvalFrequency:
        rows(lessons.data).length > 0
          ? (rows(improvements.data).length / rows(lessons.data).length) * 100
          : undefined,
      trainingLessons: rows(lessons.data).length,
      successfulImprovements: rows(improvements.data).length,
      latestEvaluation,
    };
  }

  async createEvaluationSet(input: {
    companyId: string;
    name: string;
    category: string;
    description: string;
    passThreshold: number;
    cases: Array<{
      prompt: string;
      expectedBehavior: unknown[];
      scoringCriteria: Record<string, unknown>;
    }>;
    actorUserId: string;
  }): Promise<EvaluationSet> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('evaluation_sets')
      .insert({
        company_id: input.companyId,
        name: input.name,
        category: input.category,
        description: input.description,
        pass_threshold: input.passThreshold,
        created_by_user_id: input.actorUserId,
      })
      .select('*')
      .single();
    if (error) throw error;
    const setId = String((data as Row).id);
    if (input.cases.length > 0) {
      const { error: caseError } = await client.from('evaluation_cases').insert(
        input.cases.map((item, index) => ({
          evaluation_set_id: setId,
          prompt: item.prompt,
          expected_behavior: item.expectedBehavior,
          scoring_criteria: item.scoringCriteria,
          position: index,
        })),
      );
      if (caseError) throw caseError;
    }
    return (await this.getEvaluationSet(input.companyId, setId)) as EvaluationSet;
  }

  async listEvaluationSets(companyId: string): Promise<EvaluationSet[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('evaluation_sets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result: EvaluationSet[] = [];
    for (const row of rows(data)) {
      const set = await this.getEvaluationSet(companyId, String(row.id));
      if (set) result.push(set);
    }
    return result;
  }

  async getEvaluationSet(companyId: string, setId: string): Promise<EvaluationSet | null> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('evaluation_sets')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', setId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: cases, error: casesError } = await client
      .from('evaluation_cases')
      .select('*')
      .eq('evaluation_set_id', setId)
      .order('position');
    if (casesError) throw casesError;
    return {
      ...this.evaluationSet(data as Row),
      cases: rows(cases).map((row) => this.evaluationCase(row)),
    };
  }

  async createEvaluationRun(input: {
    companyId: string;
    workerId: string;
    evaluationSetId: string;
    workerVersionId?: string;
    actorUserId: string;
  }): Promise<EvaluationRun> {
    const { data, error } = await requireAdmin(this.admin)
      .from('evaluation_runs')
      .insert({
        company_id: input.companyId,
        employee_id: input.workerId,
        evaluation_set_id: input.evaluationSetId,
        worker_version_id: input.workerVersionId ?? null,
        status: 'running',
        created_by_user_id: input.actorUserId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.evaluationRun(data as Row);
  }

  async failEvaluationRun(input: {
    companyId: string;
    runId: string;
    error: string;
  }): Promise<void> {
    const { error } = await requireAdmin(this.admin)
      .from('evaluation_runs')
      .update({
        status: 'failed',
        regression: { flagged: false, error: input.error },
        completed_at: new Date().toISOString(),
      })
      .eq('company_id', input.companyId)
      .eq('id', input.runId);
    if (error) throw error;
  }

  async finishEvaluationRun(input: {
    companyId: string;
    runId: string;
    score: number;
    passedCases: number;
    totalCases: number;
    regression: Record<string, unknown>;
  }): Promise<EvaluationRun> {
    const { data, error } = await requireAdmin(this.admin)
      .from('evaluation_runs')
      .update({
        status: 'completed',
        score: input.score,
        passed_cases: input.passedCases,
        total_cases: input.totalCases,
        regression: input.regression,
        completed_at: new Date().toISOString(),
      })
      .eq('company_id', input.companyId)
      .eq('id', input.runId)
      .select('*')
      .single();
    if (error) throw error;
    return this.evaluationRun(data as Row);
  }

  async saveEvaluationCaseResult(input: {
    runId: string;
    caseId: string;
    passed: boolean;
    score: number;
    output: string;
    rationale: string;
  }): Promise<void> {
    const { error } = await requireAdmin(this.admin).from('evaluation_case_results').upsert({
      evaluation_run_id: input.runId,
      case_id: input.caseId,
      passed: input.passed,
      score: input.score,
      output: input.output,
      rationale: input.rationale,
    });
    if (error) throw error;
  }

  async latestEvaluation(
    companyId: string,
    workerId: string,
    evaluationSetId: string,
    excludeRunId?: string,
  ): Promise<EvaluationRun | null> {
    let query = requireAdmin(this.admin)
      .from('evaluation_runs')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', workerId)
      .eq('evaluation_set_id', evaluationSetId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);
    if (excludeRunId) query = query.neq('id', excludeRunId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? this.evaluationRun(data as Row) : null;
  }

  async listMissionActivity(companyId: string, missionId: string, limit = 100): Promise<Row[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('activity_log')
      .select('*')
      .eq('company_id', companyId)
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return rows(data);
  }

  async listTemplates(companyId: string): Promise<MissionTemplate[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('mission_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) throw error;
    return rows(data).map((row) => this.template(row));
  }

  async createTemplate(input: {
    companyId: string;
    name: string;
    description: string;
    requiredCapabilities: unknown[];
    expectedWorkflow: unknown[];
    tasks: unknown[];
    dependencies: unknown[];
    approvalGates: unknown[];
    outputArtifacts: unknown[];
    actorUserId: string;
  }): Promise<MissionTemplate> {
    const { data, error } = await requireAdmin(this.admin)
      .from('mission_templates')
      .insert({
        company_id: input.companyId,
        name: input.name,
        description: input.description,
        required_capabilities: input.requiredCapabilities,
        expected_workflow: input.expectedWorkflow,
        tasks: input.tasks,
        dependencies: input.dependencies,
        approval_gates: input.approvalGates,
        output_artifacts: input.outputArtifacts,
        created_by_user_id: input.actorUserId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.template(data as Row);
  }

  async listInbox(companyId: string, limit = 100): Promise<CompanyInboxItem[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('company_inbox_items')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return rows(data).map((row) => this.inboxItem(row));
  }

  async createInboxItem(input: {
    companyId: string;
    source: CompanyInboxItem['source'];
    subject: string;
    body: string;
    payload: Record<string, unknown>;
    actorUserId?: string;
    actorWorkerId?: string;
  }): Promise<CompanyInboxItem> {
    const { data, error } = await requireAdmin(this.admin)
      .from('company_inbox_items')
      .insert({
        company_id: input.companyId,
        source: input.source,
        subject: input.subject,
        body: input.body,
        payload: input.payload,
        created_by_user_id: input.actorUserId ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    if (input.actorWorkerId) {
      await this.recordActivity(
        input.companyId,
        undefined,
        input.actorWorkerId,
        'inbox.item_received',
        input.subject,
        {},
      );
    }
    return this.inboxItem(data as Row);
  }

  async triageInboxItem(input: {
    companyId: string;
    itemId: string;
    status: CompanyInboxItem['status'];
    workerId?: string;
    missionId?: string;
    actorUserId: string;
  }): Promise<CompanyInboxItem> {
    if (input.workerId) await this.ensureWorker(input.companyId, input.workerId);
    const { data, error } = await requireAdmin(this.admin)
      .from('company_inbox_items')
      .update({
        status: input.status,
        assigned_employee_id: input.workerId ?? null,
        mission_id: input.missionId ?? null,
        triaged_at: ['triaged', 'in_progress', 'completed', 'rejected'].includes(input.status)
          ? new Date().toISOString()
          : null,
        completed_at: input.status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('company_id', input.companyId)
      .eq('id', input.itemId)
      .select('*')
      .single();
    if (error) throw error;
    return this.inboxItem(data as Row);
  }

  async listDecisions(companyId: string, limit = 100): Promise<Decision[]> {
    const { data, error } = await requireAdmin(this.admin)
      .from('decision_log')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return rows(data).map((row) => this.decision(row));
  }

  async createDecision(input: {
    companyId: string;
    decision: string;
    reason: string;
    alternatives: unknown[];
    evidence: unknown[];
    proposedByUserId?: string;
    proposedByWorkerId?: string;
    relatedMissionId?: string;
    relatedProjectId?: string;
  }): Promise<Decision> {
    const { data, error } = await requireAdmin(this.admin)
      .from('decision_log')
      .insert({
        company_id: input.companyId,
        decision: input.decision,
        reason: input.reason,
        alternatives: input.alternatives,
        evidence: input.evidence,
        proposed_by_user_id: input.proposedByUserId ?? null,
        proposed_by_employee_id: input.proposedByWorkerId ?? null,
        related_mission_id: input.relatedMissionId ?? null,
        related_project_id: input.relatedProjectId ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.decision(data as Row);
  }

  async approveDecision(input: {
    companyId: string;
    decisionId: string;
    actorUserId: string;
    status: 'approved' | 'rejected';
  }): Promise<Decision> {
    const { data, error } = await requireAdmin(this.admin)
      .from('decision_log')
      .update({
        status: input.status,
        approved_by_user_id: input.actorUserId,
        approved_at: new Date().toISOString(),
      })
      .eq('company_id', input.companyId)
      .eq('id', input.decisionId)
      .select('*')
      .single();
    if (error) throw error;
    return this.decision(data as Row);
  }

  async exportBlueprint(companyId: string): Promise<CompanyBlueprint> {
    const client = requireAdmin(this.admin);
    const { data: company, error: companyError } = await client
      .from('companies')
      .select(
        'name, slug, description, showcase_description, showcase_industry, showcase_mission, showcase_workflows, showcase_metrics',
      )
      .eq('id', companyId)
      .single();
    if (companyError) throw companyError;
    const [workers, skills, templates, evaluationSets, constitution] = await Promise.all([
      this.listWorkers(companyId),
      this.listSkills(companyId),
      this.listTemplates(companyId),
      this.listEvaluationSets(companyId),
      this.getConstitution(companyId),
    ]);
    const blueprint: CompanyBlueprint = {
      schemaVersion: 1,
      company: {
        name: String((company as Row).name),
        slug: String((company as Row).slug),
        description: optionalString((company as Row).description),
        industry: optionalString((company as Row).showcase_industry),
        mission: optionalString((company as Row).showcase_mission),
        workflows: arrayValue((company as Row).showcase_workflows),
        metrics: recordValue((company as Row).showcase_metrics),
      },
      constitution: constitution
        ? {
            version: constitution.version,
            mission: constitution.mission,
            principles: constitution.principles,
            riskTolerance: constitution.riskTolerance,
            autonomyLevel: constitution.autonomyLevel,
            spendingLimit: constitution.spendingLimit,
            approvalRequirements: constitution.approvalRequirements,
            securityRules: constitution.securityRules,
            qualityStandards: constitution.qualityStandards,
            status: constitution.status,
            activatedAt: constitution.activatedAt,
          }
        : undefined,
      workers: workers.map((worker) => ({
        name: worker.name,
        title: worker.title,
        role: worker.role,
        department: worker.department,
        description: worker.description,
        personality: worker.personality,
        communicationConfig: worker.communicationConfig,
        responsibilities: worker.responsibilities,
        operatingPrinciples: worker.operatingPrinciples,
        skills: worker.skills.map((skill) => skill.name),
        permissions: worker.permissions,
        memoryConfig: worker.memoryConfig,
        autonomyLevel: worker.autonomyLevel,
        promotionLevel: worker.promotionLevel,
        publicVisible: false,
        publicBio: undefined,
      })),
      skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        version: skill.version,
        instructions: skill.instructions,
        requiredTools: skill.requiredTools,
        requiredPermissions: skill.requiredPermissions,
        compatibility: skill.compatibility,
      })),
      missionTemplates: templates,
      evaluationSets,
    };
    return sanitizeJson(blueprint) as CompanyBlueprint;
  }

  async importBlueprint(input: {
    companyId: string;
    blueprint: CompanyBlueprint;
    actorUserId: string;
  }): Promise<{ workers: Worker[]; skills: Skill[] }> {
    const skillsByName = new Map<string, Skill>();
    for (const skill of input.blueprint.skills) {
      const created = await this.createSkill({
        companyId: input.companyId,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        requiredTools: skill.requiredTools,
        requiredPermissions: skill.requiredPermissions,
        compatibility: skill.compatibility,
      });
      skillsByName.set(skill.name, created);
    }
    const workers: Worker[] = [];
    for (const definition of input.blueprint.workers) {
      const worker = await this.createWorker({
        companyId: input.companyId,
        name: definition.name,
        title: definition.title,
        role: definition.role,
        department: definition.department,
        description: definition.description,
        personality: definition.personality,
        communicationConfig: definition.communicationConfig,
        responsibilities: definition.responsibilities,
        operatingPrinciples: definition.operatingPrinciples,
        permissions: definition.permissions,
        memoryConfig: definition.memoryConfig,
        autonomyLevel: definition.autonomyLevel,
        promotionLevel: definition.promotionLevel,
        publicVisible: false,
        publicBio: undefined,
        actorUserId: input.actorUserId,
      });
      for (const skillName of definition.skills) {
        const skill = skillsByName.get(skillName);
        if (skill)
          await this.assignSkill({
            companyId: input.companyId,
            workerId: worker.id,
            skillId: skill.id,
            actorUserId: input.actorUserId,
          });
      }
      workers.push((await this.getWorker(input.companyId, worker.id)) as Worker);
    }
    return { workers, skills: [...skillsByName.values()] };
  }

  async cloneCompany(input: {
    sourceCompanyId: string;
    name: string;
    slug: string;
    actorUserId: string;
  }): Promise<{ companyId: string; blueprint: CompanyBlueprint }> {
    const client = requireAdmin(this.admin);
    const blueprint = await this.exportBlueprint(input.sourceCompanyId);
    const { data, error } = await client
      .from('companies')
      .insert({
        name: input.name,
        slug: input.slug,
        description: blueprint.company.description ?? null,
        showcase_enabled: false,
        showcase_description: null,
        showcase_industry: blueprint.company.industry ?? null,
        showcase_mission: blueprint.company.mission ?? null,
        showcase_workflows: blueprint.company.workflows,
        showcase_metrics: {},
      })
      .select('id')
      .single();
    if (error) throw error;
    const companyId = String((data as Row).id);
    const { error: membershipError } = await client.from('company_memberships').insert({
      company_id: companyId,
      user_id: input.actorUserId,
      role: 'owner',
      status: 'active',
    });
    if (membershipError) throw membershipError;
    await this.importBlueprint({ companyId, blueprint, actorUserId: input.actorUserId });
    return { companyId, blueprint };
  }

  async getShowcaseBySlug(slug: string): Promise<CompanyShowcase | null> {
    const client = requireAdmin(this.admin);
    const { data: company, error } = await client
      .from('companies')
      .select(
        'id, name, slug, description, showcase_description, showcase_industry, showcase_mission, showcase_workflows, showcase_metrics',
      )
      .eq('slug', slug)
      .eq('showcase_enabled', true)
      .maybeSingle();
    if (error) throw error;
    if (!company) return null;
    const companyRow = company as Row;
    const { data: workerData, error: workerError } = await client
      .from('employees')
      .select('id, display_name, title, role, public_bio, avatar_url, status, promotion_level')
      .eq('company_id', String(companyRow.id ?? ''))
      .eq('public_visible', true)
      .order('display_name');
    if (workerError) throw workerError;
    const workerRows = rows(workerData);
    const workerIds = workerRows.map((row) => String(row.id));
    const skillNames = new Map<string, Array<{ name: string; version: number }>>();
    if (workerIds.length > 0) {
      const { data: links, error: linkError } = await client
        .from('worker_skills')
        .select('employee_id, skill_id')
        .in('employee_id', workerIds);
      if (linkError) throw linkError;
      const skillIds = rows(links).map((row) => String(row.skill_id));
      if (skillIds.length > 0) {
        const { data: skills, error: skillError } = await client
          .from('skills')
          .select('id, name, version')
          .in('id', skillIds);
        if (skillError) throw skillError;
        const byId = new Map(
          rows(skills).map((row) => [
            String(row.id),
            { name: String(row.name), version: Number(row.version ?? 1) },
          ]),
        );
        for (const link of rows(links)) {
          const skill = byId.get(String(link.skill_id));
          if (skill)
            skillNames.set(String(link.employee_id), [
              ...(skillNames.get(String(link.employee_id)) ?? []),
              skill,
            ]);
        }
      }
    }
    return {
      name: String(companyRow.name),
      slug: String(companyRow.slug),
      description:
        optionalString(companyRow.showcase_description) ?? optionalString(companyRow.description),
      industry: optionalString(companyRow.showcase_industry),
      mission: optionalString(companyRow.showcase_mission),
      workflows: arrayValue(sanitizeJson(companyRow.showcase_workflows)),
      metrics: sanitizeRecord(recordValue(companyRow.showcase_metrics)),
      workers: workerRows.map((row) => ({
        id: String(row.id),
        name: String(row.display_name),
        title: optionalString(row.title),
        role: optionalString(row.role),
        bio: optionalString(row.public_bio),
        avatarUrl: optionalString(row.avatar_url),
        skills: skillNames.get(String(row.id)) ?? [],
        status: normalizeWorkerStatus(row.status),
        promotionLevel: optionalString(row.promotion_level),
      })),
    };
  }

  async updateShowcase(input: {
    companyId: string;
    enabled: boolean;
    description?: string;
    industry?: string;
    mission?: string;
    workflows: unknown[];
    metrics: Record<string, unknown>;
    actorUserId: string;
  }): Promise<void> {
    const { error } = await requireAdmin(this.admin)
      .from('companies')
      .update({
        showcase_enabled: input.enabled,
        showcase_description: input.description ?? null,
        showcase_industry: input.industry ?? null,
        showcase_mission: input.mission ?? null,
        showcase_workflows: input.workflows,
        showcase_metrics: input.metrics,
      })
      .eq('id', input.companyId);
    if (error) throw error;
    await this.recordActivity(
      input.companyId,
      input.actorUserId,
      undefined,
      'showcase.updated',
      'Company showcase settings updated',
      { enabled: input.enabled },
    );
  }

  private async loadWorkerExtras(companyId: string, workerRows: Row[]): Promise<WorkerExtras> {
    const client = requireAdmin(this.admin);
    const workerIds = workerRows.map((row) => String(row.id));
    const providerIds = workerRows
      .map((row) => optionalString(row.ai_provider_id))
      .filter((value): value is string => Boolean(value));
    const departmentIds = workerRows
      .map((row) => optionalString(row.department_id))
      .filter((value): value is string => Boolean(value));
    const extras: WorkerExtras = {
      runtime: new Map(),
      skills: new Map(),
      providers: new Map(),
      departments: new Map(),
    };
    if (workerIds.length === 0) return extras;
    const { data: runtime, error: runtimeError } = await client
      .from('worker_runtime_states')
      .select('*')
      .eq('company_id', companyId)
      .in('employee_id', workerIds);
    if (runtimeError) throw runtimeError;
    for (const row of rows(runtime)) extras.runtime.set(String(row.employee_id), row);
    const { data: links, error: linksError } = await client
      .from('worker_skills')
      .select('employee_id, skill_id')
      .in('employee_id', workerIds);
    if (linksError) throw linksError;
    const skillIds = rows(links).map((row) => String(row.skill_id));
    if (skillIds.length > 0) {
      const { data: skillRows, error: skillError } = await client
        .from('skills')
        .select('*')
        .eq('company_id', companyId)
        .in('id', skillIds);
      if (skillError) throw skillError;
      const skillMap = new Map(rows(skillRows).map((row) => [String(row.id), this.skill(row)]));
      for (const link of rows(links)) {
        const skill = skillMap.get(String(link.skill_id));
        if (skill)
          extras.skills.set(String(link.employee_id), [
            ...(extras.skills.get(String(link.employee_id)) ?? []),
            skill,
          ]);
      }
    }
    if (providerIds.length > 0) {
      const { data: providerRows, error: providerError } = await client
        .from('ai_providers')
        .select('id, provider_key')
        .eq('company_id', companyId)
        .in('id', providerIds);
      if (providerError) throw providerError;
      for (const row of rows(providerRows))
        extras.providers.set(String(row.id), String(row.provider_key));
    }
    if (departmentIds.length > 0) {
      const { data: departmentRows, error: departmentError } = await client
        .from('departments')
        .select('id, name')
        .eq('company_id', companyId)
        .in('id', departmentIds);
      if (departmentError) throw departmentError;
      for (const row of rows(departmentRows))
        extras.departments.set(String(row.id), String(row.name));
    }
    return extras;
  }

  private worker(row: Row, extras: WorkerExtras): Worker {
    const workerId = String(row.id);
    const runtime = extras.runtime.get(workerId);
    const permissions = recordValue(row.permissions);
    return {
      id: workerId,
      companyId: String(row.company_id),
      name: String(row.display_name),
      title: optionalString(row.title) ?? optionalString(row.role),
      role: optionalString(row.role),
      department:
        optionalString(row.department) ??
        (optionalString(row.department_id)
          ? extras.departments.get(String(row.department_id))
          : undefined),
      departmentId: optionalString(row.department_id),
      description: optionalString(row.description),
      avatarUrl: optionalString(row.avatar_url),
      personality: optionalString(row.personality),
      communicationConfig: sanitizeRecord(recordValue(row.communication_config)),
      providerId: optionalString(row.ai_provider_id),
      providerKey: optionalString(row.ai_provider_id)
        ? extras.providers.get(String(row.ai_provider_id))
        : undefined,
      model: optionalString(row.model),
      systemInstructions: optionalString(row.system_instructions),
      responsibilities: arrayValue(row.responsibilities),
      operatingPrinciples: arrayValue(row.operating_principles),
      skills: extras.skills.get(workerId) ?? [],
      tools: arrayValue(permissions.tools),
      permissions: sanitizeRecord(permissions),
      memoryConfig: sanitizeRecord(recordValue(row.memory_config)),
      knowledgeSources: arrayValue(sanitizeJson(row.knowledge_sources)),
      trainingProfile: sanitizeRecord(recordValue(row.training_profile)),
      evaluationProfile: sanitizeRecord(recordValue(row.evaluation_profile)),
      status: normalizeWorkerStatus(runtime?.status ?? row.status),
      currentMissionId:
        optionalString(runtime?.current_mission_id) ?? optionalString(row.current_mission_id),
      currentTaskId:
        optionalString(runtime?.current_task_id) ?? optionalString(row.current_task_id),
      currentMission:
        optionalString(runtime?.current_mission_id) ??
        optionalString(row.current_mission_id) ??
        optionalString(row.current_assignment),
      currentTask: optionalString(runtime?.current_task_id) ?? optionalString(row.current_task_id),
      version: Number(row.version ?? 1),
      lastActiveAt: optionalString(runtime?.last_active_at) ?? optionalString(row.last_active_at),
      parentWorkerId: optionalString(row.parent_employee_id),
      autonomyLevel: normalizeAutonomy(row.autonomy_level),
      publicVisible: booleanValue(row.public_visible),
      publicBio: optionalString(row.public_bio),
      promotionLevel: optionalString(row.promotion_level),
      createdAt: optionalString(row.created_at),
      updatedAt: optionalString(row.updated_at),
    };
  }

  private skill(row: Row): Skill {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      name: String(row.name),
      description: String(row.description ?? ''),
      version: Number(row.version ?? 1),
      instructions: String(row.instructions ?? ''),
      requiredTools: arrayValue(row.required_tools),
      requiredPermissions: arrayValue(row.required_permissions),
      evaluationSetId: optionalString(row.evaluation_set_id),
      compatibility: recordValue(row.compatibility),
      status: String(row.status ?? 'active'),
    };
  }

  private trainingLesson(row: Row, latestReview?: TrainingReview): TrainingLesson {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      workerId: String(row.employee_id),
      title: String(row.title),
      category: String(row.category),
      lesson: String(row.lesson),
      source: String(row.source),
      examples: arrayValue(row.examples),
      correction: optionalString(row.correction),
      createdByUserId: optionalString(row.created_by_user_id),
      createdByWorkerId: optionalString(row.created_by_employee_id),
      status: normalizeLessonStatus(row.status),
      version: Number(row.version ?? 1),
      evaluationSetId: optionalString(row.evaluation_set_id),
      createdAt: String(row.created_at),
      activatedAt: optionalString(row.activated_at),
      latestReview,
    };
  }

  private trainingReview(row: Row): TrainingReview {
    return {
      id: String(row.id),
      lessonId: String(row.lesson_id),
      reviewerUserId: optionalString(row.reviewer_user_id),
      reviewerWorkerId: optionalString(row.reviewer_employee_id),
      feedback: String(row.feedback),
      decision: String(row.decision) as TrainingReview['decision'],
      createdAt: String(row.created_at),
    };
  }

  private memory(row: Row): WorkerMemory {
    return {
      id: String(row.id),
      workerId: String(row.employee_id),
      memoryType: String(row.memory_type) as WorkerMemory['memoryType'],
      title: String(row.title),
      content: row.content,
      source: String(row.source),
      approved: booleanValue(row.approved),
      createdAt: String(row.created_at),
      expiresAt: optionalString(row.expires_at),
    };
  }

  private constitution(row: Row): CompanyConstitution {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      version: Number(row.version ?? 1),
      mission: String(row.mission ?? ''),
      principles: arrayValue(row.principles),
      riskTolerance: String(row.risk_tolerance ?? 'moderate'),
      autonomyLevel: normalizeAutonomy(row.autonomy_level),
      spendingLimit: optionalNumber(row.spending_limit),
      approvalRequirements: recordValue(row.approval_requirements),
      securityRules: arrayValue(row.security_rules),
      qualityStandards: arrayValue(row.quality_standards),
      status: String(row.status ?? 'draft'),
      activatedAt: optionalString(row.activated_at),
    };
  }

  private workerVersion(row: Row): WorkerVersion {
    return {
      id: String(row.id),
      workerId: String(row.employee_id),
      version: Number(row.version),
      parentVersionId: optionalString(row.parent_version_id),
      status: String(row.status),
      changeSummary: optionalString(row.change_summary),
      snapshot: sanitizeRecord(recordValue(row.snapshot)),
      createdAt: String(row.created_at),
      activatedAt: optionalString(row.activated_at),
    };
  }

  private workerRun(row: Row): WorkerRun {
    return {
      id: String(row.id),
      workerId: String(row.employee_id),
      workerVersionId: optionalString(row.worker_version_id),
      missionId: optionalString(row.mission_id),
      taskId: optionalString(row.task_id),
      providerKey: optionalString(row.provider_key),
      model: optionalString(row.model),
      triggerType: String(row.trigger_type),
      prompt: String(row.prompt),
      contextSummary: recordValue(row.context_summary),
      output: optionalString(row.output),
      status: String(row.status),
      error: optionalString(row.error),
      startedAt: optionalString(row.started_at),
      completedAt: optionalString(row.completed_at),
      createdAt: String(row.created_at),
    };
  }

  private evaluationCase(row: Row): EvaluationCase {
    return {
      id: String(row.id),
      evaluationSetId: String(row.evaluation_set_id),
      prompt: String(row.prompt),
      expectedBehavior: arrayValue(row.expected_behavior),
      scoringCriteria: recordValue(row.scoring_criteria),
      position: Number(row.position ?? 0),
    };
  }

  private evaluationSet(row: Row): EvaluationSet {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      name: String(row.name),
      category: String(row.category),
      description: String(row.description ?? ''),
      passThreshold: Number(row.pass_threshold ?? 80),
      version: Number(row.version ?? 1),
      status: String(row.status ?? 'active'),
      cases: [],
    };
  }

  private evaluationRun(row: Row): EvaluationRun {
    return {
      id: String(row.id),
      workerId: String(row.employee_id),
      evaluationSetId: String(row.evaluation_set_id),
      workerVersionId: optionalString(row.worker_version_id),
      status: String(row.status),
      score: optionalNumber(row.score),
      passedCases: optionalNumber(row.passed_cases),
      totalCases: optionalNumber(row.total_cases),
      regression: recordValue(row.regression),
      startedAt: String(row.started_at),
      completedAt: optionalString(row.completed_at),
    };
  }

  private template(row: Row): MissionTemplate {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      name: String(row.name),
      description: String(row.description ?? ''),
      version: Number(row.version ?? 1),
      requiredCapabilities: arrayValue(row.required_capabilities),
      expectedWorkflow: arrayValue(row.expected_workflow),
      tasks: arrayValue(row.tasks),
      dependencies: arrayValue(row.dependencies),
      approvalGates: arrayValue(row.approval_gates),
      outputArtifacts: arrayValue(row.output_artifacts),
      status: String(row.status ?? 'active'),
    };
  }

  private inboxItem(row: Row): CompanyInboxItem {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      source: String(row.source) as CompanyInboxItem['source'],
      subject: String(row.subject),
      body: String(row.body),
      payload: recordValue(row.payload),
      status: String(row.status) as CompanyInboxItem['status'],
      assignedWorkerId: optionalString(row.assigned_employee_id),
      missionId: optionalString(row.mission_id),
      createdAt: String(row.created_at),
      triagedAt: optionalString(row.triaged_at),
      completedAt: optionalString(row.completed_at),
    };
  }

  private decision(row: Row): Decision {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      decision: String(row.decision),
      reason: String(row.reason ?? ''),
      alternatives: arrayValue(row.alternatives),
      evidence: arrayValue(row.evidence),
      status: String(row.status) as Decision['status'],
      proposedByWorkerId: optionalString(row.proposed_by_employee_id),
      relatedMissionId: optionalString(row.related_mission_id),
      relatedProjectId: optionalString(row.related_project_id),
      createdAt: String(row.created_at),
      approvedAt: optionalString(row.approved_at),
    };
  }

  private async ensureWorker(companyId: string, workerId: string): Promise<void> {
    const { data, error } = await requireAdmin(this.admin)
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('id', workerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Worker does not belong to the requested company');
  }

  private async ensureDepartment(companyId: string, departmentId?: string): Promise<void> {
    if (!departmentId) return;
    const { data, error } = await requireAdmin(this.admin)
      .from('departments')
      .select('id')
      .eq('company_id', companyId)
      .eq('id', departmentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Department does not belong to the requested company');
  }

  private async ensureProvider(companyId: string, providerId?: string): Promise<void> {
    if (!providerId) return;
    const { data, error } = await requireAdmin(this.admin)
      .from('ai_providers')
      .select('id')
      .eq('company_id', companyId)
      .eq('id', providerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('AI provider does not belong to the requested company');
  }

  private async createVersionSnapshot(
    companyId: string,
    workerId: string,
    version: number,
    actorUserId: string,
    snapshot: Record<string, unknown>,
    changeSummary = 'Worker configuration snapshot',
    parentVersion?: number,
  ): Promise<void> {
    const parentVersionId = parentVersion
      ? (
          await requireAdmin(this.admin)
            .from('worker_versions')
            .select('id')
            .eq('employee_id', workerId)
            .eq('version', parentVersion)
            .maybeSingle()
        ).data?.id
      : undefined;
    const { error } = await requireAdmin(this.admin)
      .from('worker_versions')
      .upsert(
        {
          company_id: companyId,
          employee_id: workerId,
          version,
          parent_version_id: parentVersionId ?? null,
          status: version === 1 ? 'active' : 'draft',
          change_summary: changeSummary,
          snapshot,
          created_by_user_id: actorUserId,
          activated_by_user_id: version === 1 ? actorUserId : null,
          activated_at: version === 1 ? new Date().toISOString() : null,
        },
        { onConflict: 'employee_id,version' },
      );
    if (error) throw error;
  }

  private snapshotFromInput(input: WorkerCreateInput): Record<string, unknown> {
    return {
      title: input.title,
      role: input.role,
      department: input.department,
      departmentId: input.departmentId,
      description: input.description,
      avatarUrl: input.avatarUrl,
      personality: input.personality,
      communicationConfig: input.communicationConfig ?? {},
      providerId: input.providerId,
      model: input.model,
      systemInstructions: input.systemInstructions,
      responsibilities: input.responsibilities ?? [],
      operatingPrinciples: input.operatingPrinciples ?? [],
      permissions: input.permissions ?? {},
      memoryConfig: input.memoryConfig ?? {},
      knowledgeSources: input.knowledgeSources ?? [],
      trainingProfile: input.trainingProfile ?? {},
      evaluationProfile: input.evaluationProfile ?? {},
      autonomyLevel: input.autonomyLevel ?? 'observe',
      publicVisible: input.publicVisible ?? false,
      publicBio: input.publicBio,
      promotionLevel: input.promotionLevel,
    };
  }

  private snapshotFromWorker(worker: Worker): Record<string, unknown> {
    return {
      name: worker.name,
      title: worker.title,
      role: worker.role,
      department: worker.department,
      departmentId: worker.departmentId,
      description: worker.description,
      avatarUrl: worker.avatarUrl,
      personality: worker.personality,
      communicationConfig: worker.communicationConfig,
      providerId: worker.providerId,
      model: worker.model,
      systemInstructions: worker.systemInstructions,
      responsibilities: worker.responsibilities,
      operatingPrinciples: worker.operatingPrinciples,
      permissions: worker.permissions,
      memoryConfig: worker.memoryConfig,
      knowledgeSources: worker.knowledgeSources,
      trainingProfile: worker.trainingProfile,
      evaluationProfile: worker.evaluationProfile,
      autonomyLevel: worker.autonomyLevel,
      publicVisible: worker.publicVisible,
      publicBio: worker.publicBio,
      promotionLevel: worker.promotionLevel,
    };
  }

  private patchToWorker(worker: Worker, input: WorkerUpdateInput): Worker {
    return {
      ...worker,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.department === undefined ? {} : { department: input.department }),
      ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
      ...(input.personality === undefined ? {} : { personality: input.personality }),
      ...(input.communicationConfig === undefined
        ? {}
        : { communicationConfig: input.communicationConfig }),
      ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
      ...(input.model === undefined ? {} : { model: input.model }),
      ...(input.systemInstructions === undefined
        ? {}
        : { systemInstructions: input.systemInstructions }),
      ...(input.responsibilities === undefined ? {} : { responsibilities: input.responsibilities }),
      ...(input.operatingPrinciples === undefined
        ? {}
        : { operatingPrinciples: input.operatingPrinciples }),
      ...(input.permissions === undefined ? {} : { permissions: input.permissions }),
      ...(input.memoryConfig === undefined ? {} : { memoryConfig: input.memoryConfig }),
      ...(input.knowledgeSources === undefined ? {} : { knowledgeSources: input.knowledgeSources }),
      ...(input.trainingProfile === undefined ? {} : { trainingProfile: input.trainingProfile }),
      ...(input.evaluationProfile === undefined
        ? {}
        : { evaluationProfile: input.evaluationProfile }),
      ...(input.autonomyLevel === undefined ? {} : { autonomyLevel: input.autonomyLevel }),
      ...(input.publicVisible === undefined ? {} : { publicVisible: input.publicVisible }),
      ...(input.publicBio === undefined ? {} : { publicBio: input.publicBio }),
      ...(input.promotionLevel === undefined ? {} : { promotionLevel: input.promotionLevel }),
    };
  }

  private async recordActivity(
    companyId: string,
    actorUserId: string | undefined,
    actorWorkerId: string | undefined,
    activityType: string,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await requireAdmin(this.admin)
      .from('activity_log')
      .insert({
        company_id: companyId,
        actor_user_id: actorUserId ?? null,
        actor_employee_id: actorWorkerId ?? null,
        activity_type: activityType,
        message,
        metadata,
      });
    if (error) throw error;
  }
}
