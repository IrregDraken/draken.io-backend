import type { AIProvider, AIProviderName, AIProviderRequest, AIProviderResponse, ComponentHealth } from '../domain.js';
import type { Config } from '../config.js';

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

class UnavailableProvider implements AIProvider {
  constructor(
    public readonly name: AIProviderName,
    private readonly configuredCredential: boolean,
  ) {}

  isConfigured(): boolean {
    return this.configuredCredential;
  }

  async healthCheck(): Promise<ComponentHealth> {
    return {
      status: 'unconfigured',
      detail: this.configuredCredential
        ? `${this.name} credentials are present, but no live adapter is installed in this foundation`
        : `${this.name} credentials are not configured`,
    };
  }

  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
    throw new ProviderUnavailableError(`${this.name} provider adapter is not available`);
  }
}

export class AIProviderRegistry {
  private readonly providers: Map<AIProviderName, AIProvider>;

  constructor(config: Config) {
    this.providers = new Map<AIProviderName, AIProvider>([
      ['openai', new UnavailableProvider('openai', Boolean(config.providerKeys.openai))],
      ['anthropic', new UnavailableProvider('anthropic', Boolean(config.providerKeys.anthropic))],
      ['google-gemini', new UnavailableProvider('google-gemini', Boolean(config.providerKeys.googleGemini))],
      ['manus', new UnavailableProvider('manus', Boolean(config.providerKeys.manus))],
    ]);
  }

  get(name: AIProviderName): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new ProviderUnavailableError(`AI provider ${name} is not registered`);
    return provider;
  }

  list(): AIProvider[] {
    return [...this.providers.values()];
  }
}
