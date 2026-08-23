import type { Config } from '../config.js';
import type { AIProvider, AIProviderName, AIProviderRequest, AIProviderResponse, ComponentHealth } from '../domain.js';

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}

abstract class HttpAIProvider implements AIProvider {
  abstract readonly name: AIProviderName;
  constructor(protected readonly apiKey: string | undefined, protected readonly baseUrl = 'https://api.openai.com/v1') {}

  isConfigured(): boolean { return Boolean(this.apiKey); }

  abstract generate(request: AIProviderRequest): Promise<AIProviderResponse>;

  async healthCheck(): Promise<ComponentHealth> {
    if (!this.apiKey) return { status: 'unconfigured', detail: `${this.name} credentials are not configured` };
    try {
      await this.checkRemote();
      return { status: 'ok', detail: `${this.name} API reachable` };
    } catch (error) {
      return { status: 'error', detail: error instanceof Error ? error.message : `${this.name} health check failed` };
    }
  }

  protected abstract checkRemote(): Promise<void>;

  protected url(path: string): string { return `${this.baseUrl.replace(/\/$/u, '')}${path}`; }

  protected requireKey(): string {
    if (!this.apiKey) throw new ProviderUnavailableError(`${this.name} provider is not configured`);
    return this.apiKey;
  }
}

class OpenAIProvider extends HttpAIProvider {
  readonly name = 'openai' as const;
  protected async checkRemote(): Promise<void> {
    await requestJson(this.url('/models'), { headers: { Authorization: `Bearer ${this.requireKey()}` } });
  }
  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const result = await requestJson<{ choices?: Array<{ message?: { content?: string } }> }>(this.url('/chat/completions'), {
      method: 'POST', headers: { Authorization: `Bearer ${this.requireKey()}` }, body: { model: request.model, messages: [{ role: 'system', content: request.systemInstructions ?? '' }, { role: 'user', content: request.prompt }] },
    });
    const output = result.choices?.[0]?.message?.content;
    if (!output) throw new ProviderRequestError('OpenAI returned no text output');
    return { provider: this.name, model: request.model, output };
  }
}

class AnthropicProvider extends HttpAIProvider {
  readonly name = 'anthropic' as const;
  protected async checkRemote(): Promise<void> {
    await requestJson('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': this.requireKey(), 'anthropic-version': '2023-06-01' } });
  }
  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const result = await requestJson<{ content?: Array<{ type?: string; text?: string }> }>('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': this.requireKey(), 'anthropic-version': '2023-06-01' }, body: { model: request.model, max_tokens: 2048, system: request.systemInstructions, messages: [{ role: 'user', content: request.prompt }] },
    });
    const output = result.content?.find((block) => block.type === 'text')?.text;
    if (!output) throw new ProviderRequestError('Anthropic returned no text output');
    return { provider: this.name, model: request.model, output };
  }
}

class GeminiProvider extends HttpAIProvider {
  readonly name = 'google-gemini' as const;
  protected async checkRemote(): Promise<void> {
    await requestJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.requireKey())}`);
  }
  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const result = await requestJson<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(this.requireKey())}`, {
      method: 'POST', body: { systemInstruction: request.systemInstructions ? { parts: [{ text: request.systemInstructions }] } : undefined, contents: [{ role: 'user', parts: [{ text: request.prompt }] }] },
    });
    const output = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!output) throw new ProviderRequestError('Gemini returned no text output');
    return { provider: this.name, model: request.model, output };
  }
}

class UnavailableProvider implements AIProvider {
  constructor(public readonly name: AIProviderName, private readonly configuredCredential: boolean) {}
  isConfigured(): boolean { return this.configuredCredential; }
  async healthCheck(): Promise<ComponentHealth> { return { status: 'unconfigured', detail: this.configuredCredential ? `${this.name} credentials are present but no stable adapter contract is configured` : `${this.name} credentials are not configured` }; }
  async generate(_request: AIProviderRequest): Promise<AIProviderResponse> { throw new ProviderUnavailableError(`${this.name} provider adapter is not available`); }
}

export class AIProviderRegistry {
  private readonly providers: Map<AIProviderName, AIProvider>;
  constructor(config: Config) {
    this.providers = new Map<AIProviderName, AIProvider>([
      ['openai', new OpenAIProvider(config.providerKeys.openai, config.providerBaseUrls.openai)],
      ['anthropic', new AnthropicProvider(config.providerKeys.anthropic)],
      ['google-gemini', new GeminiProvider(config.providerKeys.googleGemini)],
      ['manus', new UnavailableProvider('manus', Boolean(config.providerKeys.manus))],
    ]);
  }
  get(name: AIProviderName): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new ProviderUnavailableError(`AI provider ${name} is not registered`);
    return provider;
  }
  list(): AIProvider[] { return [...this.providers.values()]; }
}

async function requestJson<T = unknown>(url: string, options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const response = await fetch(url, { method: options.method ?? 'GET', headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new ProviderRequestError(`Provider request failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}
