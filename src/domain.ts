export type AuthenticatedUser = {
  id: string;
  email?: string;
  role?: string;
};

export type CompanyMembership = {
  companyId: string;
  companyName: string;
  membershipRole: string;
};

export type RequestContext = {
  user: AuthenticatedUser;
  memberships: CompanyMembership[];
};

export type CompanySummary = {
  companyId: string;
  counts: {
    employees: number;
    missions: number;
    projects: number;
    tasks: number;
    channels: number;
    messages: number;
    notifications: number;
    departments: number;
    tools: number;
    activeOrchestrations: number;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
  }>;
};

export type HealthStatus = 'ok' | 'unconfigured' | 'error';

export type ComponentHealth = {
  status: HealthStatus;
  detail?: string;
};

export type HealthReport = {
  status: HealthStatus;
  service: string;
  checkedAt: string;
  components: Record<string, ComponentHealth>;
};

export type AIProviderName = 'openai' | 'anthropic' | 'google-gemini' | 'manus';

export type AIProviderRequest = {
  model: string;
  systemInstructions?: string;
  prompt: string;
  capabilities?: string[];
};

export type AIProviderResponse = {
  provider: AIProviderName;
  model: string;
  output: string;
};

export interface AIProvider {
  readonly name: AIProviderName;
  isConfigured(): boolean;
  healthCheck(): Promise<ComponentHealth>;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export interface NotificationService {
  readonly channel: 'telegram' | 'email';
  isConfigured(): boolean;
  send(input: {
    recipient: string;
    subject?: string;
    body: string;
  }): Promise<{ delivered: boolean; detail: string }>;
}

export type MissionStage = 'created' | 'planning' | 'executing' | 'review' | 'completed' | 'failed';
export type MissionPriority = 1 | 2 | 3 | 4 | 5;
export type TaskStatus =
  'backlog' | 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled' | 'failed';

export type Department = {
  id: string;
  companyId: string;
  name: string;
  description?: string;
};

export type Employee = {
  id: string;
  companyId: string;
  displayName: string;
  roleId?: string;
  providerId?: string;
  departmentId?: string;
  description?: string;
  capabilities: unknown;
  tools: unknown;
  status: string;
  currentMissionId?: string;
  currentTaskId?: string;
  currentAssignment?: string;
};

export type Mission = {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  objective?: string;
  priority: number;
  deadline?: string;
  status: string;
  stage: MissionStage;
  progress: number;
  assignedAgentIds: string[];
  taskCount: number;
  outputCount: number;
  failureReason?: string;
};

export type Task = {
  id: string;
  companyId: string;
  missionId?: string;
  projectId?: string;
  assigneeEmployeeId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  retryLimit: number;
  retryCount: number;
  blockedReason?: string;
  dueAt?: string;
  output?: unknown;
  failureReason?: string;
  startedAt?: string;
  completedAt?: string;
};

export type ToolDefinition = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  permissions: unknown;
  status: string;
};

export type ToolExecutionRequest = {
  companyId: string;
  toolId: string;
  employeeId?: string;
  taskId?: string;
  input: Record<string, unknown>;
};

export type ActivityItem = {
  id: string;
  activityType: string;
  message: string;
  missionId?: string;
  taskId?: string;
  toolExecutionId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type BusEvent = {
  id: string;
  companyId?: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
};

export interface ToolHandler {
  readonly name: string;
  execute(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export type TelegramUser = {
  id: number;
  isBot?: boolean;
  firstName?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
};

export type TelegramMessage = {
  messageId: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
};

export type TelegramUpdate = {
  updateId: number;
  message?: TelegramMessage;
};
