import type { ComponentHealth } from '../domain.js';

export type GitHubRepository = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
};

export type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } };
};

export type GitHubIssue = { number: number; html_url: string; title: string; state: string };

export class GitHubClient {
  readonly name = 'github' as const;
  private readonly baseUrl = 'https://api.github.com';
  constructor(private readonly token?: string) {}

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  async healthCheck(): Promise<ComponentHealth> {
    if (!this.token) return { status: 'unconfigured', detail: 'GITHUB_TOKEN is not configured' };
    try {
      const user = await this.request<{ login: string }>('/user');
      return { status: 'ok', detail: `GitHub API reachable as ${user.login}` };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'GitHub health check failed',
      };
    }
  }

  async getRepository(owner: string, repository: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
    );
  }

  async listCommits(owner: string, repository: string, limit = 20): Promise<GitHubCommit[]> {
    return this.request<GitHubCommit[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?per_page=${Math.min(Math.max(limit, 1), 100)}`,
    );
  }

  async createIssue(
    owner: string,
    repository: string,
    input: { title: string; body?: string; labels?: string[] },
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues`,
      { method: 'POST', body: input },
    );
  }

  private async request<T>(
    path: string,
    options: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<T> {
    if (!this.token) throw new Error('GitHub integration is not configured');
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'content-type': 'application/json',
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`GitHub API request failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}
