export type Session = { access_token: string; refresh_token?: string; user: { id: string; email?: string } };
export type Membership = { companyId: string; companyName: string; membershipRole: string };
export type Summary = { companyId: string; counts: Record<string, number>; recentEvents: Array<{ id: string; eventType: string; occurredAt: string }> };

const TOKEN_KEY = 'draken_access_token';

export function getToken(): string | null { return window.localStorage.getItem(TOKEN_KEY); }
function saveToken(token: string | undefined): void { if (token) window.localStorage.setItem(TOKEN_KEY, token); }
function clearToken(): void { window.localStorage.removeItem(TOKEN_KEY); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? body.error ?? `Request failed with HTTP ${response.status}`);
  return body as T;
}

export async function signIn(email: string, password: string): Promise<Session> { const result = await request<{ user: Session['user']; session: Session | null }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (!result.session) throw new Error('Authentication requires email confirmation or a configured Supabase session'); saveToken(result.session.access_token); return result.session; }
export async function signUp(email: string, password: string, displayName: string, username: string): Promise<Session | null> { const result = await request<{ session: Session | null }>('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, displayName, username }) }); if (result.session) saveToken(result.session.access_token); return result.session; }
export async function signOut(): Promise<void> { try { await request('/api/v1/auth/logout', { method: 'POST' }); } finally { clearToken(); } }
export async function me(): Promise<{ user: Session['user']; memberships: Membership[] }> { return request('/api/v1/me'); }
export async function updateProfile(input: { displayName?: string; username?: string }): Promise<unknown> { return request('/api/v1/auth/profile', { method: 'PATCH', body: JSON.stringify(input) }); }
export async function health(): Promise<unknown> { return request('/health/ready'); }
export async function summary(companyId: string): Promise<{ summary: Summary }> { return request(`/api/v1/companies/${companyId}/summary`); }
export async function listResource(companyId: string, resource: string): Promise<{ records: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/resources/${resource}`); }
export async function listDepartments(companyId: string): Promise<{ departments: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/departments`); }
export async function createDepartment(companyId: string, input: { name: string; description?: string }): Promise<unknown> { return request(`/api/v1/companies/${companyId}/departments`, { method: 'POST', body: JSON.stringify(input) }); }
export async function listAgents(companyId: string): Promise<{ agents: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/agents`); }
export async function listMissions(companyId: string): Promise<{ missions: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/missions`); }
export async function createMission(companyId: string, input: Record<string, unknown>): Promise<unknown> { return request(`/api/v1/companies/${companyId}/missions`, { method: 'POST', body: JSON.stringify(input) }); }
export async function listTasks(companyId: string): Promise<{ tasks: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/tasks`); }
export async function createTask(companyId: string, input: Record<string, unknown>): Promise<unknown> { return request(`/api/v1/companies/${companyId}/tasks`, { method: 'POST', body: JSON.stringify(input) }); }
export async function listActivity(companyId: string): Promise<{ activity: Array<Record<string, unknown>> }> { return request(`/api/v1/companies/${companyId}/activity`); }
export async function executeCommand(companyId: string, input: { command: string; provider: string; model: string }): Promise<{ mission: Record<string, unknown>; execution: string }> { return request(`/api/v1/companies/${companyId}/commands`, { method: 'POST', body: JSON.stringify(input) }); }
