import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { AIProviderRegistry } from '../src/integrations/ai.js';
import { createExternalIntegrations } from '../src/integrations/external.js';
import { TelegramClient } from '../src/integrations/telegram.js';
import { HealthService } from '../src/services/health.js';
import type { Config } from '../src/config.js';

const config: Config = {
  nodeEnv: 'test', host: '127.0.0.1', port: 3000, logLevel: 'silent', publicAppUrl: undefined, webDir: 'public', rateLimitMax: 120, rateLimitWindow: '1 minute', corsOrigins: [],
  telegramAuthorizedUserIds: [], telegramMode: 'disabled', providerKeys: {}, providerBaseUrls: {},
};


describe('HealthService', () => {
  it('reports liveness independently of integrations', () => {
    const health = new HealthService({ configured: false }, new TelegramClient(undefined, undefined, pino({ level: 'silent' })), new AIProviderRegistry(config), createExternalIntegrations({}), pino({ level: 'silent' }));
    expect(health.live().status).toBe('ok');
  });

  it('reports unconfigured persistence and integrations without inventing readiness', async () => {
    const health = new HealthService({ configured: false }, new TelegramClient(undefined, undefined, pino({ level: 'silent' })), new AIProviderRegistry(config), createExternalIntegrations({}), pino({ level: 'silent' }));
    const report = await health.ready();
    expect(report.status).toBe('unconfigured');
    expect(report.components.database?.status).toBe('unconfigured');
    expect(report.components.telegram?.status).toBe('unconfigured');
    expect(report.components.github?.status).toBe('unconfigured');
  });
});
