import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { AIProvider } from '../src/integrations/ai.js';
import type { Mission } from '../src/domain.js';
import {
  CommandService,
  type AIProviderLookup,
  type MissionWriter,
} from '../src/services/commandService.js';
import {
  ToolExecutionService,
  ToolRegistry,
  type ToolExecutionRepository,
} from '../src/services/toolRegistry.js';

describe('product execution boundaries', () => {
  it('creates a mission only from valid structured provider output', async () => {
    const createMission = vi.fn(
      async () => ({ id: 'mission-1', title: 'Launch', stage: 'created' }) as unknown as Mission,
    );
    const provider = createProvider(
      JSON.stringify({
        title: 'Launch',
        objective: 'Ship the release',
        description: 'Release work',
        priority: 2,
      }),
    );
    const providers: AIProviderLookup = { get: () => provider };
    const repository: MissionWriter = { createMission };
    const service = new CommandService(providers, repository);
    const result = await service.execute({
      companyId: 'company-1',
      actorUserId: 'user-1',
      command: 'Ship the release',
      provider: 'openai',
      model: 'test',
    });
    expect(createMission).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        actorUserId: 'user-1',
        title: 'Launch',
        priority: 2,
        assignedAgentIds: [],
      }),
    );
    expect(result.execution).toBe('mission_created_unassigned');
  });

  it('refuses malformed provider plans instead of creating fake missions', async () => {
    const createMission = vi.fn(async () => ({}) as Mission);
    const provider = createProvider('not-json');
    const service = new CommandService({ get: () => provider }, { createMission });
    await expect(
      service.execute({
        companyId: 'company-1',
        actorUserId: 'user-1',
        command: 'Ship the release',
        provider: 'openai',
        model: 'test',
      }),
    ).rejects.toThrow('valid mission JSON');
    expect(createMission).not.toHaveBeenCalled();
  });

  it('denies tool execution without an employee assignment', async () => {
    const repository: ToolExecutionRepository = {
      createToolExecution: vi.fn(async () => 'execution-1'),
      listTools: vi.fn(async () => [
        {
          id: 'tool-1',
          companyId: 'company-1',
          name: 'safe-tool',
          description: 'safe',
          inputSchema: {},
          outputSchema: {},
          permissions: {},
          status: 'active',
        },
      ]),
      finishToolExecution: vi.fn(async () => undefined),
      hasEmployeeTool: vi.fn(async () => false),
      writeActivity: vi.fn(async () => undefined),
    };
    const service = new ToolExecutionService(
      repository,
      new ToolRegistry(),
      pino({ level: 'silent' }),
    );
    const result = await service.execute({ companyId: 'company-1', toolId: 'tool-1', input: {} });
    expect(result.status).toBe('denied');
    expect(repository.finishToolExecution).toHaveBeenCalledWith(
      'company-1',
      'execution-1',
      expect.objectContaining({ status: 'denied' }),
    );
  });
});

function createProvider(output: string): AIProvider {
  return {
    name: 'openai',
    isConfigured: () => true,
    healthCheck: async () => ({ status: 'ok' }),
    generate: async () => ({ provider: 'openai', model: 'test', output }),
  };
}
