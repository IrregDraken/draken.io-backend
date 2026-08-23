import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { CommandService } from '../src/services/commandService.js';
import { ToolExecutionService, ToolRegistry } from '../src/services/toolRegistry.js';

describe('product execution boundaries', () => {
  it('creates a mission only from valid structured provider output', async () => {
    const createMission = vi.fn().mockResolvedValue({ id: 'mission-1', title: 'Launch', stage: 'created' });
    const provider = { generate: vi.fn().mockResolvedValue({ provider: 'openai', model: 'test', output: JSON.stringify({ title: 'Launch', objective: 'Ship the release', description: 'Release work', priority: 2 }) }), get: vi.fn().mockReturnValue({ isConfigured: () => true }) };
    const service = new CommandService({ get: () => provider } as any, { createMission } as any);
    const result = await service.execute({ companyId: 'company-1', actorUserId: 'user-1', command: 'Ship the release', provider: 'openai', model: 'test' });
    expect(createMission).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-1', actorUserId: 'user-1', title: 'Launch', priority: 2, assignedAgentIds: [] }));
    expect(result.execution).toBe('mission_created_unassigned');
  });

  it('refuses malformed provider plans instead of creating fake missions', async () => {
    const createMission = vi.fn();
    const provider = { generate: vi.fn().mockResolvedValue({ provider: 'openai', model: 'test', output: 'not-json' }) };
    const service = new CommandService({ get: () => provider } as any, { createMission } as any);
    await expect(service.execute({ companyId: 'company-1', actorUserId: 'user-1', command: 'Ship the release', provider: 'openai', model: 'test' })).rejects.toThrow('valid mission JSON');
    expect(createMission).not.toHaveBeenCalled();
  });

  it('denies tool execution without an employee assignment', async () => {
    const repository = { createToolExecution: vi.fn().mockResolvedValue('execution-1'), listTools: vi.fn().mockResolvedValue([{ id: 'tool-1', name: 'safe-tool', description: 'safe', inputSchema: {}, outputSchema: {}, permissions: {}, status: 'active' }]), finishToolExecution: vi.fn(), writeActivity: vi.fn(), hasEmployeeTool: vi.fn() };
    const service = new ToolExecutionService(repository as any, new ToolRegistry(), pino({ level: 'silent' }));
    const result = await service.execute({ companyId: 'company-1', toolId: 'tool-1', input: {} });
    expect(result.status).toBe('denied');
    expect(repository.finishToolExecution).toHaveBeenCalledWith('company-1', 'execution-1', expect.objectContaining({ status: 'denied' }));
  });
});
