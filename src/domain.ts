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
  send(input: { recipient: string; subject?: string; body: string }): Promise<{ delivered: boolean; detail: string }>;
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
