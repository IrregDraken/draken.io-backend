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

export type Worker = {
  id: string;
  companyId: string;
  name: string;
  title?: string;
  role?: string;
  department?: string;
  description?: string;
  avatarUrl?: string;
  providerKey?: string;
  model?: string;
  systemInstructions?: string;
  responsibilities: unknown[];
  operatingPrinciples: unknown[];
  skills: Array<{ id: string; name: string; version: number; description: string }>;
  permissions: Record<string, unknown>;
  memoryConfig: Record<string, unknown>;
  status: string;
  currentMission?: string;
  currentTask?: string;
  version: number;
  lastActiveAt?: string;
  autonomyLevel: string;
  publicVisible: boolean;
  promotionLevel?: string;
};

export type TrainingLesson = {
  id: string;
  workerId: string;
  title: string;
  category: string;
  lesson: string;
  source: string;
  examples: unknown[];
  correction?: string;
  status: string;
  version: number;
  createdAt: string;
  activatedAt?: string;
  latestReview?: { feedback: string; decision: string; createdAt: string };
};

export type WorkerPerformance = {
  missionsCompleted: number;
  tasksCompleted: number;
  taskSuccessRate?: number;
  evaluationScore?: number;
  averageTaskDurationMs?: number;
  toolFailures: number;
  humanCorrections: number;
  regressionEvents: number;
  approvalFrequency?: number;
  trainingLessons: number;
  successfulImprovements: number;
  latestEvaluation?: {
    score?: number;
    passedCases?: number;
    totalCases?: number;
    completedAt?: string;
  };
};

export type CompanyShowcase = {
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  mission?: string;
  workers: Array<{
    id: string;
    name: string;
    title?: string;
    role?: string;
    bio?: string;
    avatarUrl?: string;
    skills: Array<{ name: string; version: number }>;
    status: string;
    promotionLevel?: string;
  }>;
  metrics: Record<string, unknown>;
  workflows: unknown[];
};

export type EvaluationSet = {
  id: string;
  name: string;
  category: string;
  description: string;
  passThreshold: number;
  cases: Array<{ id: string; prompt: string; expectedBehavior: unknown[] }>;
};

export type CompanyInboxItem = {
  id: string;
  source: string;
  subject: string;
  body: string;
  status: string;
  assignedWorkerId?: string;
  createdAt: string;
};

export type Decision = {
  id: string;
  decision: string;
  reason: string;
  status: string;
  createdAt: string;
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

export async function listWorkers(companyId: string): Promise<{ workers: Worker[] }> {
  return request(`/api/v1/companies/${companyId}/workers`);
}

export async function createWorker(
  companyId: string,
  input: {
    name: string;
    title?: string;
    role?: string;
    description?: string;
    autonomyLevel?: string;
  },
): Promise<{ worker: Worker }> {
  return request(`/api/v1/companies/${companyId}/workers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getWorker(companyId: string, workerId: string): Promise<{ worker: Worker }> {
  return request(`/api/v1/companies/${companyId}/workers/${workerId}`);
}

export async function listTraining(
  companyId: string,
  workerId: string,
): Promise<{ lessons: TrainingLesson[] }> {
  return request(`/api/v1/companies/${companyId}/workers/${workerId}/training`);
}

export async function proposeTraining(
  companyId: string,
  workerId: string,
  input: {
    title: string;
    category: string;
    lesson: string;
    source: string;
    examples?: unknown[];
    correction?: string;
  },
): Promise<{ lesson: TrainingLesson }> {
  return request(`/api/v1/companies/${companyId}/workers/${workerId}/training`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reviewTraining(
  companyId: string,
  lessonId: string,
  input: { feedback: string; decision: 'approve' | 'reject' | 'request_changes' },
): Promise<{ lesson: TrainingLesson }> {
  return request(`/api/v1/companies/${companyId}/training-lessons/${lessonId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function activateTraining(
  companyId: string,
  lessonId: string,
): Promise<{ lesson: TrainingLesson }> {
  return request(`/api/v1/companies/${companyId}/training-lessons/${lessonId}/activate`, {
    method: 'POST',
  });
}

export async function getWorkerPerformance(
  companyId: string,
  workerId: string,
): Promise<{ performance: WorkerPerformance }> {
  return request(`/api/v1/companies/${companyId}/workers/${workerId}/performance`);
}

export async function runWorker(
  companyId: string,
  workerId: string,
  input: { prompt: string; triggerType?: string },
): Promise<{ output: string; provider: string; model: string }> {
  return request(`/api/v1/companies/${companyId}/workers/${workerId}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listEvaluationSets(
  companyId: string,
): Promise<{ evaluationSets: EvaluationSet[] }> {
  return request(`/api/v1/companies/${companyId}/evaluation-sets`);
}

export async function runEvaluationSet(
  companyId: string,
  evaluationSetId: string,
  workerId: string,
): Promise<JsonObject> {
  return request(`/api/v1/companies/${companyId}/evaluation-sets/${evaluationSetId}/run`, {
    method: 'POST',
    body: JSON.stringify({ workerId }),
  });
}

export async function listInbox(companyId: string): Promise<{ items: CompanyInboxItem[] }> {
  return request(`/api/v1/companies/${companyId}/inbox`);
}

export async function listDecisions(companyId: string): Promise<{ decisions: Decision[] }> {
  return request(`/api/v1/companies/${companyId}/decisions`);
}

export async function getCompanyShowcase(
  companyId: string,
): Promise<{ showcase: CompanyShowcase | null }> {
  return request(`/api/v1/companies/${companyId}/showcase`);
}

export async function updateCompanyShowcase(
  companyId: string,
  input: {
    enabled: boolean;
    description?: string;
    industry?: string;
    mission?: string;
    workflows?: unknown[];
    metrics?: Record<string, unknown>;
  },
): Promise<{ updated: boolean }> {
  return request(`/api/v1/companies/${companyId}/showcase`, {
    method: 'PUT',
    body: JSON.stringify({ workflows: [], metrics: {}, ...input }),
  });
}
