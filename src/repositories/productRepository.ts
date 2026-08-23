import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityItem, Department, Employee, Mission, MissionStage, Task, ToolDefinition, ToolExecutionRequest } from '../domain.js';

type Row = Record<string, any>;

function requireAdmin(admin?: SupabaseClient): SupabaseClient {
  if (!admin) throw new Error('Supabase is not configured');
  return admin;
}

export class ProductRepository {
  constructor(private readonly admin?: SupabaseClient) {}

  async listDepartments(companyId: string): Promise<Department[]> {
    const { data, error } = await requireAdmin(this.admin).from('departments').select('id, company_id, name, description').eq('company_id', companyId).order('name');
    if (error) throw error;
    return (data ?? []).map((row: Row) => ({ id: String(row.id), companyId: String(row.company_id), name: String(row.name), description: row.description ?? undefined }));
  }

  async createDepartment(input: { companyId: string; name: string; description?: string }): Promise<Department> {
    const { data, error } = await requireAdmin(this.admin).from('departments').insert({ company_id: input.companyId, name: input.name, description: input.description ?? null }).select('id, company_id, name, description').single();
    if (error) throw error;
    return { id: String(data.id), companyId: String(data.company_id), name: String(data.name), description: data.description ?? undefined };
  }

  async listEmployees(companyId: string): Promise<Employee[]> {
    const { data, error } = await requireAdmin(this.admin).from('employees').select('*').eq('company_id', companyId).order('display_name');
    if (error) throw error;
    return (data ?? []).map((row: Row) => this.employee(row));
  }

  async listMissions(companyId: string): Promise<Mission[]> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client.from('missions').select('*, mission_agents(employee_id), tasks(id), mission_outputs(id)').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: Row) => ({
      id: String(row.id), companyId: String(row.company_id), title: String(row.title ?? row.name), description: row.description ?? undefined, objective: row.objective ?? undefined,
      priority: Number(row.priority ?? 3), deadline: row.due_at ?? undefined, status: String(row.status), stage: String(row.stage ?? 'created') as MissionStage,
      progress: Number(row.progress ?? 0), assignedAgentIds: (row.mission_agents ?? []).map((agent: Row) => String(agent.employee_id)), taskCount: (row.tasks ?? []).length,
      outputCount: (row.mission_outputs ?? []).length, failureReason: row.failure_reason ?? undefined,
    }));
  }

  async createMission(input: { companyId: string; title: string; description?: string; objective?: string; priority: number; deadline?: string; assignedAgentIds: string[]; actorUserId: string }): Promise<Mission> {
    const client = requireAdmin(this.admin);
    await this.ensureEmployeesInCompany(input.companyId, input.assignedAgentIds);
    const { data, error } = await client.from('missions').insert({
      company_id: input.companyId, name: input.title, title: input.title, description: input.description ?? null, objective: input.objective ?? null,
      priority: input.priority, due_at: input.deadline ?? null, status: 'planned', stage: 'created', progress: 0,
    }).select('*').single();
    if (error) throw error;
    if (input.assignedAgentIds.length > 0) {
      const { error: assignmentError } = await client.from('mission_agents').insert(input.assignedAgentIds.map((employeeId) => ({ mission_id: data.id, employee_id: employeeId, assigned_by_user_id: input.actorUserId })));
      if (assignmentError) throw assignmentError;
    }
    await this.recordEvent({ companyId: input.companyId, actorUserId: input.actorUserId, eventType: 'mission.created', aggregateType: 'mission', aggregateId: String(data.id), payload: { title: input.title } });
    return {
      id: String(data.id), companyId: String(data.company_id), title: String(data.title ?? data.name), description: data.description ?? undefined, objective: data.objective ?? undefined,
      priority: Number(data.priority), deadline: data.due_at ?? undefined, status: String(data.status), stage: String(data.stage) as MissionStage, progress: Number(data.progress), assignedAgentIds: input.assignedAgentIds, taskCount: 0, outputCount: 0,
    };
  }

  async transitionMission(input: { companyId: string; missionId: string; stage: MissionStage; actorUserId: string; failureReason?: string }): Promise<void> {
    const client = requireAdmin(this.admin);
    const { data: mission, error: findError } = await client.from('missions').select('id, stage, status').eq('company_id', input.companyId).eq('id', input.missionId).single();
    if (findError) throw findError;
    const current = String(mission.stage ?? 'created') as MissionStage;
    if (!isValidMissionTransition(current, input.stage)) throw new Error(`Invalid mission transition from ${current} to ${input.stage}`);
    const status = input.stage === 'completed' ? 'completed' : input.stage === 'failed' ? 'failed' : input.stage === 'executing' ? 'active' : input.stage === 'review' ? 'active' : 'planned';
    const progress = input.stage === 'completed' ? 100 : input.stage === 'created' ? 0 : undefined;
    const { error } = await client.from('missions').update({ stage: input.stage, status, ...(progress === undefined ? {} : { progress }), failure_reason: input.failureReason ?? null }).eq('company_id', input.companyId).eq('id', input.missionId);
    if (error) throw error;
    await this.recordEvent({ companyId: input.companyId, actorUserId: input.actorUserId, eventType: `mission.${input.stage}`, aggregateType: 'mission', aggregateId: input.missionId, payload: { from: current, to: input.stage, failureReason: input.failureReason } });
  }

  async listTasks(companyId: string, missionId?: string): Promise<Task[]> {
    let query = requireAdmin(this.admin).from('tasks').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (missionId) query = query.eq('mission_id', missionId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Row) => this.task(row));
  }

  async createTask(input: { companyId: string; missionId?: string; projectId?: string; title: string; description?: string; priority: number; retryLimit: number; assigneeEmployeeId?: string; dueAt?: string; actorUserId: string }): Promise<Task> {
    const client = requireAdmin(this.admin);
    await this.ensureOptionalForeignKeys(input.companyId, input.missionId, input.projectId, input.assigneeEmployeeId);
    const { data, error } = await client.from('tasks').insert({
      company_id: input.companyId, mission_id: input.missionId ?? null, project_id: input.projectId ?? null, title: input.title, description: input.description ?? null,
      priority: input.priority, retry_limit: input.retryLimit, assignee_employee_id: input.assigneeEmployeeId ?? null, due_at: input.dueAt ?? null, status: 'backlog',
    }).select('*').single();
    if (error) throw error;
    await this.recordEvent({ companyId: input.companyId, actorUserId: input.actorUserId, eventType: 'task.created', aggregateType: 'task', aggregateId: String(data.id), payload: { missionId: input.missionId, title: input.title } });
    return this.task(data);
  }

  async transitionTask(input: { companyId: string; taskId: string; status: string; actorUserId: string; failureReason?: string; blockedReason?: string; output?: unknown }): Promise<Task> {
    const client = requireAdmin(this.admin);
    const { data: existing, error: findError } = await client.from('tasks').select('*').eq('company_id', input.companyId).eq('id', input.taskId).single();
    if (findError) throw findError;
    const current = String(existing.status);
    if (!isValidTaskTransition(current, input.status)) throw new Error(`Invalid task transition from ${current} to ${input.status}`);
    const timestamp = new Date().toISOString();
    const patch = { status: input.status, failure_reason: input.failureReason ?? null, blocked_reason: input.blockedReason ?? (input.status === 'blocked' ? existing.blocked_reason : null), output: input.output ?? existing.output ?? null, ...(input.status === 'in_progress' ? { started_at: timestamp } : {}), ...(input.status === 'done' || input.status === 'failed' ? { completed_at: timestamp } : {}) };
    const { data, error } = await client.from('tasks').update(patch).eq('company_id', input.companyId).eq('id', input.taskId).select('*').single();
    if (error) throw error;
    await this.recordEvent({ companyId: input.companyId, actorUserId: input.actorUserId, eventType: `task.${input.status}`, aggregateType: 'task', aggregateId: input.taskId, payload: { from: current, to: input.status, failureReason: input.failureReason } });
    await this.writeActivity({ companyId: input.companyId, actorUserId: input.actorUserId, activityType: `task.${input.status}`, taskId: input.taskId, message: `Task transitioned from ${current} to ${input.status}`, metadata: { failureReason: input.failureReason } });
    return this.task(data);
  }

  async getTask(companyId: string, taskId: string): Promise<Task | null> {
    const { data, error } = await requireAdmin(this.admin).from('tasks').select('*').eq('company_id', companyId).eq('id', taskId).maybeSingle();
    if (error) throw error;
    return data ? this.task(data) : null;
  }

  async retryTask(input: { companyId: string; taskId: string; actorUserId: string }): Promise<Task> {
    const client = requireAdmin(this.admin);
    const { data: existing, error: findError } = await client.from('tasks').select('*').eq('company_id', input.companyId).eq('id', input.taskId).single();
    if (findError) throw findError;
    const retryCount = Number(existing.retry_count ?? 0);
    const retryLimit = Number(existing.retry_limit ?? 0);
    if (retryCount >= retryLimit) throw new Error('Task retry limit reached');
    const { data, error } = await client.from('tasks').update({ status: 'todo', retry_count: retryCount + 1, failure_reason: null, last_error: null, completed_at: null }).eq('company_id', input.companyId).eq('id', input.taskId).select('*').single();
    if (error) throw error;
    await this.recordEvent({ companyId: input.companyId, actorUserId: input.actorUserId, eventType: 'task.retried', aggregateType: 'task', aggregateId: input.taskId, payload: { retryCount: retryCount + 1, retryLimit } });
    return this.task(data);
  }

  async addDependency(input: { companyId: string; taskId: string; dependsOnTaskId: string }): Promise<void> {
    const client = requireAdmin(this.admin);
    const { data: tasks, error: taskError } = await client.from('tasks').select('id').eq('company_id', input.companyId).in('id', [input.taskId, input.dependsOnTaskId]);
    if (taskError) throw taskError;
    if ((tasks ?? []).length !== 2) throw new Error('Task dependency crosses company boundary or references a missing task');
    const { error } = await client.from('task_dependencies').insert({ task_id: input.taskId, depends_on_task_id: input.dependsOnTaskId });
    if (error) throw error;
  }

  async dependenciesComplete(companyId: string, taskId: string): Promise<boolean> {
    const client = requireAdmin(this.admin);
    const { data: dependencies, error } = await client.from('task_dependencies').select('depends_on_task_id').eq('task_id', taskId);
    if (error) throw error;
    if (!dependencies?.length) return true;
    const ids = dependencies.map((row: Row) => row.depends_on_task_id);
    const { data: tasks, error: taskError } = await client.from('tasks').select('status').eq('company_id', companyId).in('id', ids);
    if (taskError) throw taskError;
    return (tasks ?? []).length === ids.length && (tasks ?? []).every((task: Row) => task.status === 'done');
  }

  async listActivity(companyId: string, limit = 50): Promise<ActivityItem[]> {
    const { data, error } = await requireAdmin(this.admin).from('activity_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row: Row) => ({ id: String(row.id), activityType: String(row.activity_type), message: String(row.message), missionId: row.mission_id ?? undefined, taskId: row.task_id ?? undefined, toolExecutionId: row.tool_execution_id ?? undefined, createdAt: String(row.created_at), metadata: row.metadata ?? {} }));
  }

  async listTools(companyId: string): Promise<ToolDefinition[]> {
    const { data, error } = await requireAdmin(this.admin).from('tools').select('*').eq('company_id', companyId).order('name');
    if (error) throw error;
    return (data ?? []).map((row: Row) => this.tool(row));
  }

  async createTool(input: { companyId: string; name: string; description: string; inputSchema: unknown; outputSchema: unknown; permissions: unknown }): Promise<ToolDefinition> {
    const { data, error } = await requireAdmin(this.admin).from('tools').insert({ company_id: input.companyId, name: input.name, description: input.description, input_schema: input.inputSchema, output_schema: input.outputSchema, permissions: input.permissions, status: 'pending' }).select('*').single();
    if (error) throw error;
    return this.tool(data);
  }

  async hasEmployeeTool(companyId: string, employeeId: string, toolId: string): Promise<boolean> {
    const { data: employee, error: employeeError } = await requireAdmin(this.admin).from('employees').select('id').eq('company_id', companyId).eq('id', employeeId).maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee) return false;
    const { data, error } = await requireAdmin(this.admin).from('employee_tools').select('employee_id').eq('employee_id', employeeId).eq('tool_id', toolId).maybeSingle();
    if (error) throw error;
    if (!data) return false;
    const { data: tool, error: toolError } = await requireAdmin(this.admin).from('tools').select('id').eq('company_id', companyId).eq('id', toolId).eq('status', 'active').maybeSingle();
    if (toolError) throw toolError;
    return Boolean(tool);
  }

  async createToolExecution(input: ToolExecutionRequest): Promise<string> {
    const client = requireAdmin(this.admin);
    const { data: tool, error: toolError } = await client.from('tools').select('id').eq('company_id', input.companyId).eq('id', input.toolId).maybeSingle();
    if (toolError) throw toolError;
    if (!tool) throw new Error('Tool not found for company');
    if (input.employeeId) await this.ensureEmployeesInCompany(input.companyId, [input.employeeId]);
    if (input.taskId) {
      const { data: task, error: taskError } = await client.from('tasks').select('id').eq('company_id', input.companyId).eq('id', input.taskId).maybeSingle();
      if (taskError) throw taskError;
      if (!task) throw new Error('Task not found for company');
    }
    const { data, error } = await client.from('tool_executions').insert({ company_id: input.companyId, tool_id: input.toolId, employee_id: input.employeeId ?? null, task_id: input.taskId ?? null, status: 'requested', input: input.input }).select('id').single();
    if (error) throw error;
    return String(data.id);
  }

  async finishToolExecution(companyId: string, executionId: string, result: { status: 'succeeded' | 'failed' | 'denied'; output?: unknown; error?: string }): Promise<void> {
    const { error } = await requireAdmin(this.admin).from('tool_executions').update({ status: result.status, output: result.output ?? null, error: result.error ?? null, completed_at: new Date().toISOString() }).eq('company_id', companyId).eq('id', executionId);
    if (error) throw error;
  }

  async writeTaskLog(input: { companyId: string; taskId: string; level: string; message: string; metadata?: Record<string, unknown> }): Promise<void> {
    const { error } = await requireAdmin(this.admin).from('task_logs').insert({ company_id: input.companyId, task_id: input.taskId, level: input.level, message: input.message, metadata: input.metadata ?? {} });
    if (error) throw error;
  }

  async writeActivity(input: { companyId: string; actorUserId?: string; actorEmployeeId?: string; activityType: string; missionId?: string; taskId?: string; toolExecutionId?: string; message: string; metadata?: Record<string, unknown> }): Promise<void> {
    const { error } = await requireAdmin(this.admin).from('activity_log').insert({ company_id: input.companyId, actor_user_id: input.actorUserId ?? null, actor_employee_id: input.actorEmployeeId ?? null, activity_type: input.activityType, mission_id: input.missionId ?? null, task_id: input.taskId ?? null, tool_execution_id: input.toolExecutionId ?? null, message: input.message, metadata: input.metadata ?? {} });
    if (error) throw error;
  }

  async publishBusEvent(input: { companyId?: string; eventType: string; aggregateType?: string; aggregateId?: string; payload?: Record<string, unknown> }): Promise<string> {
    const { data, error } = await requireAdmin(this.admin).from('message_bus_events').insert({ company_id: input.companyId ?? null, event_type: input.eventType, aggregate_type: input.aggregateType ?? null, aggregate_id: input.aggregateId ?? null, payload: input.payload ?? {} }).select('id').single();
    if (error) throw error;
    return String(data.id);
  }

  async claimPendingBusEvents(limit = 20): Promise<Array<{ id: string; companyId?: string; eventType: string; aggregateType?: string; aggregateId?: string; payload: Record<string, unknown> }>> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client.from('message_bus_events').select('*').eq('status', 'pending').lte('available_at', new Date().toISOString()).order('created_at').limit(limit);
    if (error) throw error;
    const claimed: Array<{ id: string; companyId?: string; eventType: string; aggregateType?: string; aggregateId?: string; payload: Record<string, unknown> }> = [];
    for (const row of (data ?? []) as Row[]) {
      const { data: updated, error: updateError } = await client.from('message_bus_events').update({ status: 'processing', attempts: Number(row.attempts ?? 0) + 1 }).eq('id', row.id).eq('status', 'pending').select('*').maybeSingle();
      if (updateError) throw updateError;
      if (updated) claimed.push({ id: String(updated.id), companyId: updated.company_id ?? undefined, eventType: String(updated.event_type), aggregateType: updated.aggregate_type ?? undefined, aggregateId: updated.aggregate_id ?? undefined, payload: updated.payload ?? {} });
    }
    return claimed;
  }

  async finishBusEvent(id: string, result: { status: 'processed' | 'failed'; error?: string }): Promise<void> {
    const { error } = await requireAdmin(this.admin).from('message_bus_events').update({ status: result.status, last_error: result.error ?? null, processed_at: result.status === 'processed' ? new Date().toISOString() : null }).eq('id', id);
    if (error) throw error;
  }

  async recordEvent(input: { companyId: string; actorUserId?: string; eventType: string; aggregateType?: string; aggregateId?: string; payload?: Record<string, unknown> }): Promise<void> {
    const client = requireAdmin(this.admin);
    const event = { company_id: input.companyId, actor_user_id: input.actorUserId ?? null, event_type: input.eventType, entity_type: input.aggregateType ?? null, entity_id: input.aggregateId ?? null, payload: input.payload ?? {} };
    const { error } = await client.from('events').insert(event);
    if (error) throw error;
    const { error: busError } = await client.from('message_bus_events').insert({ company_id: input.companyId, event_type: input.eventType, aggregate_type: input.aggregateType ?? null, aggregate_id: input.aggregateId ?? null, payload: input.payload ?? {} });
    if (busError) throw busError;
  }

  private async ensureEmployeesInCompany(companyId: string, employeeIds: string[]): Promise<void> {
    if (employeeIds.length === 0) return;
    const { data, error } = await requireAdmin(this.admin).from('employees').select('id').eq('company_id', companyId).in('id', employeeIds);
    if (error) throw error;
    if ((data ?? []).length !== employeeIds.length) throw new Error('One or more employees do not belong to the requested company');
  }

  private async ensureOptionalForeignKeys(companyId: string, missionId?: string, projectId?: string, assigneeEmployeeId?: string): Promise<void> {
    const client = requireAdmin(this.admin);
    if (missionId) { const { data, error } = await client.from('missions').select('id').eq('company_id', companyId).eq('id', missionId).maybeSingle(); if (error) throw error; if (!data) throw new Error('Mission does not belong to the requested company'); }
    if (projectId) { const { data, error } = await client.from('projects').select('id').eq('company_id', companyId).eq('id', projectId).maybeSingle(); if (error) throw error; if (!data) throw new Error('Project does not belong to the requested company'); }
    if (assigneeEmployeeId) await this.ensureEmployeesInCompany(companyId, [assigneeEmployeeId]);
  }

  private employee(row: Row): Employee {
    return { id: String(row.id), companyId: String(row.company_id), displayName: String(row.display_name), roleId: row.role_id ?? undefined, providerId: row.ai_provider_id ?? undefined, departmentId: row.department_id ?? undefined, description: row.description ?? undefined, capabilities: row.capabilities ?? [], tools: row.permissions ?? {}, status: String(row.status), currentMissionId: row.current_mission_id ?? undefined, currentTaskId: row.current_task_id ?? undefined, currentAssignment: row.current_assignment ?? undefined };
  }

  private task(row: Row): Task {
    return { id: String(row.id), companyId: String(row.company_id), missionId: row.mission_id ?? undefined, projectId: row.project_id ?? undefined, assigneeEmployeeId: row.assignee_employee_id ?? undefined, title: String(row.title), description: row.description ?? undefined, status: String(row.status) as Task['status'], priority: Number(row.priority ?? 3), retryLimit: Number(row.retry_limit ?? 0), retryCount: Number(row.retry_count ?? 0), blockedReason: row.blocked_reason ?? undefined, dueAt: row.due_at ?? undefined, output: row.output ?? undefined, failureReason: row.failure_reason ?? undefined, startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined };
  }

  private tool(row: Row): ToolDefinition {
    return { id: String(row.id), companyId: String(row.company_id), name: String(row.name), description: String(row.description), inputSchema: row.input_schema ?? {}, outputSchema: row.output_schema ?? {}, permissions: row.permissions ?? {}, status: String(row.status) };
  }
}

const missionTransitions: Record<MissionStage, MissionStage[]> = { created: ['planning', 'failed'], planning: ['executing', 'failed'], executing: ['review', 'failed'], review: ['completed', 'executing', 'failed'], completed: [], failed: ['planning'] };
function isValidMissionTransition(current: MissionStage, next: MissionStage): boolean { return current === next || missionTransitions[current]?.includes(next) === true; }

const taskTransitions: Record<string, string[]> = { backlog: ['todo', 'cancelled'], todo: ['in_progress', 'blocked', 'cancelled'], in_progress: ['blocked', 'review', 'done', 'failed', 'cancelled'], blocked: ['todo', 'in_progress', 'cancelled'], review: ['in_progress', 'done', 'failed'], failed: ['todo', 'cancelled'], done: [], cancelled: [] };
function isValidTaskTransition(current: string, next: string): boolean { return taskTransitions[current]?.includes(next) === true; }
