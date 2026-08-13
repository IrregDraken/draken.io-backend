import type { ComponentHealth, NotificationService } from '../domain.js';

export interface GitHubIntegration {
  readonly name: 'github';
  healthCheck(): Promise<ComponentHealth>;
}

export interface EmailIntegration extends NotificationService {
  readonly channel: 'email';
}

export interface ZapierIntegration {
  readonly name: 'zapier';
  healthCheck(): Promise<ComponentHealth>;
  publish(event: { type: string; payload: Record<string, unknown> }): Promise<{ delivered: boolean; detail: string }>;
}

export interface DockerSandboxIntegration {
  readonly name: 'docker-sandbox';
  healthCheck(): Promise<ComponentHealth>;
  run(input: { image: string; command: string[] }): Promise<{ accepted: boolean; detail: string }>;
}

class UnavailableGitHub implements GitHubIntegration {
  readonly name = 'github' as const;
  constructor(private readonly configured: boolean) {}
  async healthCheck(): Promise<ComponentHealth> {
    return { status: 'unconfigured', detail: this.configured ? 'Credentials are present; live adapter is pending' : 'GITHUB_TOKEN is not configured' };
  }
}

export class UnavailableEmail implements EmailIntegration {
  readonly channel = 'email' as const;
  constructor(private readonly configured: boolean) {}
  isConfigured(): boolean { return false; }
  async send(_input: { recipient: string; subject?: string; body: string }): Promise<{ delivered: boolean; detail: string }> {
    return { delivered: false, detail: this.configured ? 'Email adapter is pending' : 'RESEND_API_KEY is not configured' };
  }
}

class UnavailableZapier implements ZapierIntegration {
  readonly name = 'zapier' as const;
  constructor(private readonly configured: boolean) {}
  async healthCheck(): Promise<ComponentHealth> {
    return { status: 'unconfigured', detail: this.configured ? 'Webhook is configured; live adapter is pending' : 'ZAPIER_WEBHOOK_URL is not configured' };
  }
  async publish(_event: { type: string; payload: Record<string, unknown> }): Promise<{ delivered: boolean; detail: string }> {
    return { delivered: false, detail: this.configured ? 'Zapier adapter is pending' : 'ZAPIER_WEBHOOK_URL is not configured' };
  }
}

class UnavailableDockerSandbox implements DockerSandboxIntegration {
  readonly name = 'docker-sandbox' as const;
  constructor(private readonly configured: boolean) {}
  async healthCheck(): Promise<ComponentHealth> {
    return { status: 'unconfigured', detail: this.configured ? 'Endpoint is configured; live adapter is pending' : 'DOCKER_SANDBOX_URL is not configured' };
  }
  async run(_input: { image: string; command: string[] }): Promise<{ accepted: boolean; detail: string }> {
    return { accepted: false, detail: this.configured ? 'Docker sandbox adapter is pending' : 'DOCKER_SANDBOX_URL is not configured' };
  }
}

export function createExternalIntegrations(config: {
  githubToken?: string;
  resendApiKey?: string;
  zapierWebhookUrl?: string;
  dockerSandboxUrl?: string;
}) {
  return {
    github: new UnavailableGitHub(Boolean(config.githubToken)),
    email: new UnavailableEmail(Boolean(config.resendApiKey)),
    zapier: new UnavailableZapier(Boolean(config.zapierWebhookUrl)),
    dockerSandbox: new UnavailableDockerSandbox(Boolean(config.dockerSandboxUrl)),
  };
}
