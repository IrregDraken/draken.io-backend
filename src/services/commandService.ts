import type { AIProviderName } from '../domain.js';
import type { AIProviderRegistry } from '../integrations/ai.js';
import type { ProductRepository } from '../repositories/productRepository.js';

export class CommandService {
  constructor(private readonly providers: AIProviderRegistry, private readonly repository: ProductRepository) {}

  async execute(input: { companyId: string; actorUserId: string; command: string; provider: AIProviderName; model: string }) {
    const response = await this.providers.get(input.provider).generate({
      model: input.model,
      prompt: [
        'Convert the operator command into JSON only. Do not include markdown fences.',
        'The JSON schema is: {"title": string, "objective": string, "description": string, "priority": 1|2|3|4|5}.',
        `Operator command: ${input.command}`,
      ].join('\n'),
      systemInstructions: 'You are the Draken mission planner. Return only valid JSON. Do not claim tasks, agents, tools, or outputs that were not provided.',
    });
    const plan = parsePlan(response.output);
    const mission = await this.repository.createMission({ companyId: input.companyId, actorUserId: input.actorUserId, title: plan.title, objective: plan.objective, description: plan.description, priority: plan.priority, assignedAgentIds: [] });
    return { mission, provider: response.provider, model: response.model, execution: 'mission_created_unassigned' as const };
  }
}

function parsePlan(raw: string): { title: string; objective: string; description?: string; priority: 1 | 2 | 3 | 4 | 5 } {
  const normalized = raw.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(normalized); } catch { throw new Error('AI provider did not return valid mission JSON'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('AI provider returned an invalid mission plan');
  const plan = parsed as Record<string, unknown>;
  const title = typeof plan.title === 'string' ? plan.title.trim() : '';
  const objective = typeof plan.objective === 'string' ? plan.objective.trim() : '';
  const description = typeof plan.description === 'string' ? plan.description.trim() : undefined;
  const priority = plan.priority;
  if (!title || !objective || ![1, 2, 3, 4, 5].includes(priority as number)) throw new Error('AI provider returned an incomplete mission plan');
  return { title, objective, description, priority: priority as 1 | 2 | 3 | 4 | 5 };
}
