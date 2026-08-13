import type { AIProviderName, AIProviderRequest, AIProviderResponse } from '../domain.js';
import { AIProviderRegistry } from '../integrations/ai.js';

export class OrchestratorService {
  constructor(private readonly providers: AIProviderRegistry) {}

  async run(input: { provider: AIProviderName; request: AIProviderRequest }): Promise<AIProviderResponse> {
    const provider = this.providers.get(input.provider);
    return provider.generate(input.request);
  }
}
