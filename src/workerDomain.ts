export const autonomyLevels = [
  'observe',
  'suggest',
  'prepare',
  'ask',
  'execute',
  'autonomous',
] as const;

export type AutonomyLevel = (typeof autonomyLevels)[number];

export const workerStatuses = [
  'online',
  'busy',
  'waiting',
  'paused',
  'offline',
  'error',
  'disabled',
] as const;

export type WorkerStatus = (typeof workerStatuses)[number];

export const lessonStatuses = [
  'proposed',
  'reviewing',
  'approved',
  'active',
  'rejected',
  'archived',
] as const;

export type LessonStatus = (typeof lessonStatuses)[number];

export type Worker = {
  id: string;
  companyId: string;
  name: string;
  title?: string;
  role?: string;
  department?: string;
  departmentId?: string;
  description?: string;
  avatarUrl?: string;
  personality?: string;
  communicationConfig: Record<string, unknown>;
  providerId?: string;
  providerKey?: string;
  model?: string;
  systemInstructions?: string;
  responsibilities: unknown[];
  operatingPrinciples: unknown[];
  skills: Skill[];
  tools: unknown[];
  permissions: Record<string, unknown>;
  memoryConfig: Record<string, unknown>;
  knowledgeSources: unknown[];
  trainingProfile: Record<string, unknown>;
  evaluationProfile: Record<string, unknown>;
  status: WorkerStatus;
  currentMissionId?: string;
  currentTaskId?: string;
  currentMission?: string;
  currentTask?: string;
  version: number;
  lastActiveAt?: string;
  parentWorkerId?: string;
  autonomyLevel: AutonomyLevel;
  publicVisible: boolean;
  publicBio?: string;
  promotionLevel?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Skill = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  version: number;
  instructions: string;
  requiredTools: unknown[];
  requiredPermissions: unknown[];
  evaluationSetId?: string;
  compatibility: Record<string, unknown>;
  status: string;
};

export type TrainingLesson = {
  id: string;
  companyId: string;
  workerId: string;
  title: string;
  category: string;
  lesson: string;
  source: string;
  examples: unknown[];
  correction?: string;
  createdByUserId?: string;
  createdByWorkerId?: string;
  status: LessonStatus;
  version: number;
  evaluationSetId?: string;
  createdAt: string;
  activatedAt?: string;
  latestReview?: TrainingReview;
};

export type TrainingReview = {
  id: string;
  lessonId: string;
  reviewerUserId?: string;
  reviewerWorkerId?: string;
  feedback: string;
  decision: 'approve' | 'reject' | 'request_changes';
  createdAt: string;
};

export type WorkerKnowledge = {
  id: string;
  workerId: string;
  title: string;
  source: string;
  content: unknown;
  status: 'proposed' | 'approved' | 'active' | 'rejected' | 'archived';
  createdAt: string;
  approvedAt?: string;
};

export type WorkerMemory = {
  id: string;
  workerId: string;
  memoryType: 'working' | 'agent' | 'project' | 'company' | 'training' | 'decision';
  title: string;
  content: unknown;
  source: string;
  approved: boolean;
  createdAt: string;
  expiresAt?: string;
};

export type CompanyConstitution = {
  id: string;
  companyId: string;
  version: number;
  mission: string;
  principles: unknown[];
  riskTolerance: string;
  autonomyLevel: AutonomyLevel;
  spendingLimit?: number;
  approvalRequirements: Record<string, unknown>;
  securityRules: unknown[];
  qualityStandards: unknown[];
  status: string;
  activatedAt?: string;
};

export type WorkerDNA = {
  id: string;
  name: string;
  version: number;
  title?: string;
  role?: string;
  provider?: string;
  model?: string;
  skills: Array<{ name: string; version: number }>;
  operatingPrincipleCount: number;
  knowledgeSourceCount: number;
  trainingLessonCount: number;
  evaluationSetCount: number;
  permissionKeys: string[];
  autonomyLevel: AutonomyLevel;
};

export type WorkerVersion = {
  id: string;
  workerId: string;
  version: number;
  parentVersionId?: string;
  status: string;
  changeSummary?: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  activatedAt?: string;
};

export type WorkerRun = {
  id: string;
  workerId: string;
  workerVersionId?: string;
  missionId?: string;
  taskId?: string;
  providerKey?: string;
  model?: string;
  triggerType: string;
  prompt: string;
  contextSummary: Record<string, unknown>;
  output?: string;
  status: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type EvaluationCase = {
  id: string;
  evaluationSetId: string;
  prompt: string;
  expectedBehavior: unknown[];
  scoringCriteria: Record<string, unknown>;
  position: number;
};

export type EvaluationSet = {
  id: string;
  companyId: string;
  name: string;
  category: string;
  description: string;
  passThreshold: number;
  version: number;
  status: string;
  cases: EvaluationCase[];
};

export type EvaluationRun = {
  id: string;
  workerId: string;
  evaluationSetId: string;
  workerVersionId?: string;
  status: string;
  score?: number;
  passedCases?: number;
  totalCases?: number;
  regression: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
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
  latestEvaluation?: EvaluationRun;
};

export type CompanyInboxItem = {
  id: string;
  companyId: string;
  source: 'ceo' | 'telegram' | 'github' | 'zapier' | 'webhook' | 'scheduled_job' | 'worker';
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  status: 'new' | 'triaged' | 'in_progress' | 'completed' | 'rejected';
  assignedWorkerId?: string;
  missionId?: string;
  createdAt: string;
  triagedAt?: string;
  completedAt?: string;
};

export type Decision = {
  id: string;
  companyId: string;
  decision: string;
  reason: string;
  alternatives: unknown[];
  evidence: unknown[];
  status: 'proposed' | 'approved' | 'rejected';
  proposedByWorkerId?: string;
  relatedMissionId?: string;
  relatedProjectId?: string;
  createdAt: string;
  approvedAt?: string;
};

export type MissionTemplate = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  version: number;
  requiredCapabilities: unknown[];
  expectedWorkflow: unknown[];
  tasks: unknown[];
  dependencies: unknown[];
  approvalGates: unknown[];
  outputArtifacts: unknown[];
  status: string;
};

export type WorkerShowcase = {
  id: string;
  name: string;
  title?: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  skills: Array<{ name: string; version: number }>;
  status: WorkerStatus;
  promotionLevel?: string;
};

export type CompanyShowcase = {
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  mission?: string;
  workers: WorkerShowcase[];
  metrics: Record<string, unknown>;
  workflows: unknown[];
};

export type CompanyBlueprint = {
  schemaVersion: 1;
  company: {
    name: string;
    slug: string;
    description?: string;
    industry?: string;
    mission?: string;
    workflows: unknown[];
    metrics: Record<string, unknown>;
  };
  constitution?: Omit<CompanyConstitution, 'id' | 'companyId'>;
  workers: Array<{
    name: string;
    title?: string;
    role?: string;
    department?: string;
    description?: string;
    personality?: string;
    communicationConfig: Record<string, unknown>;
    responsibilities: unknown[];
    operatingPrinciples: unknown[];
    skills: string[];
    permissions: Record<string, unknown>;
    memoryConfig: Record<string, unknown>;
    autonomyLevel: AutonomyLevel;
    promotionLevel?: string;
    publicVisible: boolean;
    publicBio?: string;
  }>;
  skills: Array<{
    name: string;
    description: string;
    version: number;
    instructions: string;
    requiredTools: unknown[];
    requiredPermissions: unknown[];
    compatibility: Record<string, unknown>;
  }>;
  missionTemplates: MissionTemplate[];
  evaluationSets: EvaluationSet[];
};

export type WorkerRuntimeContext = {
  worker: Pick<
    Worker,
    | 'id'
    | 'name'
    | 'title'
    | 'role'
    | 'description'
    | 'personality'
    | 'responsibilities'
    | 'operatingPrinciples'
    | 'autonomyLevel'
    | 'version'
  >;
  provider: { key?: string; model?: string };
  constitution?: Pick<
    CompanyConstitution,
    | 'mission'
    | 'principles'
    | 'riskTolerance'
    | 'autonomyLevel'
    | 'approvalRequirements'
    | 'securityRules'
    | 'qualityStandards'
  >;
  skills: Array<Pick<Skill, 'name' | 'description' | 'instructions' | 'requiredTools'>>;
  tools: Array<{ name: string; description: string }>;
  lessons: Array<Pick<TrainingLesson, 'title' | 'category' | 'lesson' | 'correction' | 'examples'>>;
  knowledge: Array<{ title: string; source: string; content: unknown }>;
  memory: Array<Pick<WorkerMemory, 'memoryType' | 'title' | 'content' | 'source'>>;
  permissions: Record<string, unknown>;
};
