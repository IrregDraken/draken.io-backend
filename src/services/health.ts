import type { Logger } from 'pino';
import type { ComponentHealth, HealthReport } from '../domain.js';
import type { AIProviderRegistry } from '../integrations/ai.js';
import type { TelegramClient } from '../integrations/telegram.js';
import type { SupabaseClients } from '../supabase.js';
import type {
  DockerSandboxIntegration,
  GitHubIntegration,
  ZapierIntegration,
  EmailIntegration,
} from '../integrations/external.js';

export class HealthService {
  constructor(
    private readonly clients: SupabaseClients,
    private readonly telegram: TelegramClient,
    private readonly providers: AIProviderRegistry,
    private readonly external: {
      github: GitHubIntegration;
      email: EmailIntegration;
      zapier: ZapierIntegration;
      dockerSandbox: DockerSandboxIntegration;
    },
    private readonly logger: Logger,
  ) {}

  live(): HealthReport {
    return {
      status: 'ok',
      service: 'draken-industries-backend',
      checkedAt: new Date().toISOString(),
      components: { process: { status: 'ok' } },
    };
  }

  async ready(): Promise<HealthReport> {
    const components: Record<string, ComponentHealth> = {
      process: { status: 'ok' },
      database: await this.databaseHealth(),
      telegram: await this.telegram.healthCheck(),
      github: await this.external.github.healthCheck(),
      email: await this.external.email.healthCheck(),
      zapier: await this.external.zapier.healthCheck(),
      dockerSandbox: await this.external.dockerSandbox.healthCheck(),
    };
    for (const provider of this.providers.list()) {
      components[`ai:${provider.name}`] = await provider.healthCheck();
    }

    const statuses = Object.values(components).map((component) => component.status);
    const status = statuses.includes('error')
      ? 'error'
      : statuses.includes('unconfigured')
        ? 'unconfigured'
        : 'ok';
    return {
      status,
      service: 'draken-industries-backend',
      checkedAt: new Date().toISOString(),
      components,
    };
  }

  private async databaseHealth(): Promise<ComponentHealth> {
    if (!this.clients.admin || !this.clients.configured)
      return { status: 'unconfigured', detail: 'Supabase is not configured' };
    try {
      const { error } = await this.clients.admin
        .from('companies')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return { status: 'ok', detail: 'Supabase is reachable' };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'unknown error' },
        'Database health check failed',
      );
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Database health check failed',
      };
    }
  }
}
