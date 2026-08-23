import type { ComponentHealth, NotificationService } from '../domain.js';
import { GitHubClient } from './github.js';

export interface GitHubIntegration extends Pick<
  GitHubClient,
  'isConfigured' | 'getRepository' | 'listCommits' | 'createIssue'
> {
  readonly name: 'github';
  healthCheck(): Promise<ComponentHealth>;
}

export interface EmailIntegration extends NotificationService {
  readonly channel: 'email';
  healthCheck(): Promise<ComponentHealth>;
}

export interface ZapierIntegration {
  readonly name: 'zapier';
  healthCheck(): Promise<ComponentHealth>;
  publish(event: {
    type: string;
    payload: Record<string, unknown>;
  }): Promise<{ delivered: boolean; detail: string }>;
}

export interface DockerSandboxIntegration {
  readonly name: 'docker-sandbox';
  healthCheck(): Promise<ComponentHealth>;
  run(input: {
    image: string;
    command: string[];
    environment?: Record<string, string>;
  }): Promise<{ accepted: boolean; detail: string; jobId?: string }>;
}

export class ResendEmailService implements EmailIntegration {
  readonly channel = 'email' as const;
  constructor(
    private readonly apiKey?: string,
    private readonly fromEmail?: string,
  ) {}
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.fromEmail);
  }
  async healthCheck(): Promise<ComponentHealth> {
    if (!this.isConfigured())
      return {
        status: 'unconfigured',
        detail: 'RESEND_API_KEY and RESEND_FROM_EMAIL are required',
      };
    try {
      await this.request('/domains');
      return { status: 'ok', detail: 'Resend API reachable' };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Resend health check failed',
      };
    }
  }
  async send(input: {
    recipient: string;
    subject?: string;
    body: string;
  }): Promise<{ delivered: boolean; detail: string }> {
    if (!this.isConfigured()) return { delivered: false, detail: 'Resend email is not configured' };
    if (!input.subject) return { delivered: false, detail: 'Email subject is required' };
    try {
      await this.request('/emails', {
        method: 'POST',
        body: {
          from: this.fromEmail,
          to: [input.recipient],
          subject: input.subject,
          text: input.body,
        },
      });
      return { delivered: true, detail: 'Email accepted by Resend' };
    } catch (error) {
      return {
        delivered: false,
        detail: error instanceof Error ? error.message : 'Email delivery failed',
      };
    }
  }
  private async request(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}) {
    const response = await fetch(`https://api.resend.com${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Resend API request failed with HTTP ${response.status}`);
    return response.json();
  }
}

export class ZapierWebhookIntegration implements ZapierIntegration {
  readonly name = 'zapier' as const;
  constructor(private readonly webhookUrl?: string) {}
  async healthCheck(): Promise<ComponentHealth> {
    return this.webhookUrl
      ? {
          status: 'unconfigured',
          detail:
            'Zapier webhook URL is configured; delivery is verified when an event is published',
        }
      : { status: 'unconfigured', detail: 'ZAPIER_WEBHOOK_URL is not configured' };
  }
  async publish(event: {
    type: string;
    payload: Record<string, unknown>;
  }): Promise<{ delivered: boolean; detail: string }> {
    if (!this.webhookUrl) return { delivered: false, detail: 'Zapier webhook is not configured' };
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: event.type,
          payload: event.payload,
          occurredAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Zapier webhook failed with HTTP ${response.status}`);
      return { delivered: true, detail: 'Zapier webhook accepted event' };
    } catch (error) {
      return {
        delivered: false,
        detail: error instanceof Error ? error.message : 'Zapier delivery failed',
      };
    }
  }
}

export class DockerSandboxClient implements DockerSandboxIntegration {
  readonly name = 'docker-sandbox' as const;
  constructor(
    private readonly baseUrl?: string,
    private readonly token?: string,
  ) {}
  async healthCheck(): Promise<ComponentHealth> {
    if (!this.baseUrl)
      return { status: 'unconfigured', detail: 'DOCKER_SANDBOX_URL is not configured' };
    try {
      await this.request('/health');
      return { status: 'ok', detail: 'Docker sandbox reachable' };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Docker sandbox health check failed',
      };
    }
  }
  async run(input: {
    image: string;
    command: string[];
    environment?: Record<string, string>;
  }): Promise<{ accepted: boolean; detail: string; jobId?: string }> {
    if (!this.baseUrl) return { accepted: false, detail: 'Docker sandbox is not configured' };
    try {
      const result = await this.request<{ jobId?: string }>('/jobs', {
        method: 'POST',
        body: input,
      });
      return { accepted: true, detail: 'Docker sandbox accepted job', jobId: result.jobId };
    } catch (error) {
      return {
        accepted: false,
        detail: error instanceof Error ? error.message : 'Docker sandbox job failed',
      };
    }
  }
  private async request<T = unknown>(
    path: string,
    options: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        'content-type': 'application/json',
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Docker sandbox request failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}

export function createExternalIntegrations(config: {
  githubToken?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  zapierWebhookUrl?: string;
  dockerSandboxUrl?: string;
  dockerSandboxToken?: string;
}) {
  return {
    github: new GitHubClient(config.githubToken),
    email: new ResendEmailService(config.resendApiKey, config.resendFromEmail),
    zapier: new ZapierWebhookIntegration(config.zapierWebhookUrl),
    dockerSandbox: new DockerSandboxClient(config.dockerSandboxUrl, config.dockerSandboxToken),
  };
}
