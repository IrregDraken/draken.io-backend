import { afterEach, describe, expect, it } from 'vitest';
import type { Config } from '../src/config.js';
import { buildApp } from '../src/app.js';

const config: Config = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 3000,
  logLevel: 'silent',
  publicAppUrl: undefined,
  webDir: 'public',
  rateLimitMax: 120,
  rateLimitWindow: '1 minute',
  corsOrigins: [],
  telegramAuthorizedUserIds: [],
  telegramMode: 'disabled',
  providerKeys: {},
  providerBaseUrls: {},
};

const runtimes: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.app.close();
});

describe('HTTP boundary', () => {
  it('exposes process liveness', async () => {
    const runtime = await buildApp(config);
    runtimes.push(runtime);
    const response = await runtime.app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('does not claim readiness when Supabase is missing', async () => {
    const runtime = await buildApp(config);
    runtimes.push(runtime);
    const response = await runtime.app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json().components.database.status).toBe('unconfigured');
  });

  it('protects API identity routes when authentication is unconfigured', async () => {
    const runtime = await buildApp(config);
    runtimes.push(runtime);
    const response = await runtime.app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('authentication_unconfigured');
  });

  it('reports the public showcase as unconfigured instead of exposing or fabricating data', async () => {
    const runtime = await buildApp(config);
    runtimes.push(runtime);
    const response = await runtime.app.inject({ method: 'GET', url: '/showcase/example-company' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('showcase_unconfigured');
  });

  it('registers worker routes behind the same authentication boundary', async () => {
    const runtime = await buildApp(config);
    runtimes.push(runtime);
    const response = await runtime.app.inject({
      method: 'GET',
      url: '/api/v1/companies/00000000-0000-0000-0000-000000000000/workers',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('authentication_unconfigured');
  });
});
