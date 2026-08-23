import type { Logger } from 'pino';
import type { ToolDefinition, ToolHandler, ToolExecutionRequest } from '../domain.js';
import type { ProductRepository } from '../repositories/productRepository.js';

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    if (this.handlers.has(handler.name)) throw new Error(`Tool handler already registered: ${handler.name}`);
    this.handlers.set(handler.name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  async execute(definition: ToolDefinition, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    validateInput(definition.inputSchema, input);
    const handler = this.handlers.get(definition.name);
    if (!handler) throw new Error(`Tool handler is unavailable: ${definition.name}`);
    return handler.execute(input);
  }
}

export class ToolExecutionService {
  constructor(private readonly repository: ProductRepository, private readonly registry: ToolRegistry, private readonly logger: Logger) {}

  async execute(input: ToolExecutionRequest): Promise<{ executionId: string; status: string; output?: Record<string, unknown>; error?: string }> {
    const executionId = await this.repository.createToolExecution(input);
    let definition: ToolDefinition | undefined;
    try {
      const definitions = await this.repository.listTools(input.companyId);
      definition = definitions.find((tool) => tool.id === input.toolId);
      if (!definition) throw new Error('Tool not found for company');
      if (!input.employeeId) {
        await this.repository.finishToolExecution(input.companyId, executionId, { status: 'denied', error: 'Tool execution requires an agent identity' });
        return { executionId, status: 'denied', error: 'Tool execution requires an agent identity' };
      }
      if (!(await this.repository.hasEmployeeTool(input.companyId, input.employeeId, input.toolId))) {
        await this.repository.finishToolExecution(input.companyId, executionId, { status: 'denied', error: 'Tool is not assigned to this agent' });
        return { executionId, status: 'denied', error: 'Tool is not assigned to this agent' };
      }
      const output = await this.registry.execute(definition, input.input);
      await this.repository.finishToolExecution(input.companyId, executionId, { status: 'succeeded', output });
      await this.repository.writeActivity({ companyId: input.companyId, actorEmployeeId: input.employeeId, activityType: 'tool.succeeded', taskId: input.taskId, toolExecutionId: executionId, message: `Tool ${definition.name} completed`, metadata: { toolId: definition.id } });
      return { executionId, status: 'succeeded', output };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      this.logger.error({ toolId: input.toolId, executionId, error: message }, 'Tool execution failed');
      await this.repository.finishToolExecution(input.companyId, executionId, { status: 'failed', error: message });
      await this.repository.writeActivity({ companyId: input.companyId, actorEmployeeId: input.employeeId, activityType: 'tool.failed', taskId: input.taskId, toolExecutionId: executionId, message: `Tool ${definition?.name ?? input.toolId} failed`, metadata: { error: message } });
      return { executionId, status: 'failed', error: message };
    }
  }
}

function validateInput(schema: unknown, input: Record<string, unknown>): void {
  if (!schema || typeof schema !== 'object') return;
  const jsonSchema = schema as { type?: string; required?: unknown; properties?: Record<string, { type?: string }> };
  if (jsonSchema.type && jsonSchema.type !== 'object') throw new Error('Tool input schema must describe an object');
  const required = Array.isArray(jsonSchema.required) ? jsonSchema.required.filter((value): value is string => typeof value === 'string') : [];
  for (const key of required) if (!(key in input)) throw new Error(`Missing required tool input: ${key}`);
  for (const [key, property] of Object.entries(jsonSchema.properties ?? {})) {
    if (!(key in input) || !property?.type) continue;
    const value = input[key];
    const valid = property.type === 'string' ? typeof value === 'string' : property.type === 'number' ? typeof value === 'number' : property.type === 'boolean' ? typeof value === 'boolean' : true;
    if (!valid) throw new Error(`Invalid type for tool input: ${key}`);
  }
}
