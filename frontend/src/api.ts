export type Session = {
  access_token: string;
  refresh_token?: string;
  user: { id: string; email?: string };
};

export type Membership = {
  companyId: string;
  companyName: string;
  membershipRole: string;
};

export type Summary = {
  companyId: string;
  counts: Record<string, number>;
  recentEvents: Array<{ id: string; eventType: string; occurredAt: string }>;
};

export type HealthReport = {
  status: string;
  checkedAt: string;
  components: Record<string, { status: string; detail?: string }>;
};

type JsonObject = Record<string, unknown>;

const TOKEN_KEY = 'draken_access_token';

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string | undefined): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const parsed: unknown = await response.json().catch(() => null);
  const body = isJsonObject(parsed) ? parsed : {};
  if (!response.ok) throw new Error(readErrorMessage(body, response.status));
  return parsed as T;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readErrorMessage(body: JsonObject, status: number): string {
  const message =
    typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : undefined;
  return message ?? `Request failed with HTTP ${status}`;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const result = await request<{ user: Session['user']; session: Session | null }>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  if (!result.session)
    throw new Error('Authentication requires email confirmation or a configured Supabase session');
  saveToken(result.session.access_token);
  return result.session;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  username: string,
): Promise<Session | null> {
  const result = await request<{ session: Session | null }>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, username }),
  });
  if (result.session) saveToken(result.session.access_token);
  return result.session;
}

export async function signOut(): Promise<void> {
  try {
    await request('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

export async function me(): Promise<{ user: Session['user']; memberships: Membership[] }> {
  return request('/api/v1/me');
}

export async function updateProfile(input: {
  displayName?: string;
  username?: string;
}): Promise<JsonObject> {
  return request('/api/v1/auth/profile', { method: 'PATCH', body: JSON.stringify(input) });
}

export async function health(): Promise<HealthReport> {
  return request('/health/ready');
}

export async function summary(companyId: string): Promise<{ summary: Summary }> {
  return request(`/api/v1/companies/${companyId}/summary`);
}

export async function listResource(
  companyId: string,
  resource: string,
): Promise<{ records: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/resources/${encodeURIComponent(resource)}`);
}

export async function listDepartments(companyId: string): Promise<{ departments: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/departments`);
}

export async function createDepartment(
  companyId: string,
  input: { name: string; description?: string },
): Promise<{ department: JsonObject }> {
  return request(`/api/v1/companies/${companyId}/departments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listAgents(companyId: string): Promise<{ agents: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/agents`);
}

export async function listMissions(companyId: string): Promise<{ missions: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/missions`);
}

export async function createMission(
  companyId: string,
  input: JsonObject,
): Promise<{ mission: JsonObject }> {
  return request(`/api/v1/companies/${companyId}/missions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listTasks(companyId: string): Promise<{ tasks: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/tasks`);
}

export async function createTask(
  companyId: string,
  input: JsonObject,
): Promise<{ task: JsonObject }> {
  return request(`/api/v1/companies/${companyId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listActivity(companyId: string): Promise<{ activity: JsonObject[] }> {
  return request(`/api/v1/companies/${companyId}/activity`);
}

export async function executeCommand(
  companyId: string,
  input: { command: string; provider: string; model: string },
): Promise<{ mission: JsonObject; execution: string }> {
  return request(`/api/v1/companies/${companyId}/commands`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
