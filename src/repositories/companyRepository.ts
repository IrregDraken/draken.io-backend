import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompanyMembership, CompanySummary } from '../domain.js';

type DatabaseRow = Record<string, unknown>;

function requireAdmin(admin?: SupabaseClient): SupabaseClient {
  if (!admin) throw new Error('Supabase is not configured');
  return admin;
}

export class CompanyRepository {
  constructor(private readonly admin?: SupabaseClient) {}

  async getMembershipsForUser(userId: string): Promise<CompanyMembership[]> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('company_memberships')
      .select('company_id, role, companies!inner(name)')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;

    return ((data ?? []) as DatabaseRow[]).flatMap((row) => {
      const company = row.companies as DatabaseRow | null;
      if (!company || typeof row.company_id !== 'string' || typeof company.name !== 'string')
        return [];
      return [
        {
          companyId: row.company_id,
          companyName: company.name,
          membershipRole: String(row.role ?? 'member'),
        },
      ];
    });
  }

  async getMembershipForUser(userId: string, companyId: string): Promise<CompanyMembership | null> {
    const memberships = await this.getMembershipsForUser(userId);
    return memberships.find((membership) => membership.companyId === companyId) ?? null;
  }

  async getCompany(
    companyId: string,
  ): Promise<{ id: string; name: string; slug: string; status: string } | null> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('companies')
      .select('id, name, slug, status')
      .eq('id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      slug: String(data.slug),
      status: String(data.status),
    };
  }

  async getSummary(companyId: string): Promise<CompanySummary> {
    const client = requireAdmin(this.admin);
    const tables = [
      'employees',
      'missions',
      'projects',
      'tasks',
      'channels',
      'messages',
      'notifications',
    ] as const;
    const countEntries = await Promise.all(
      tables.map(async (table) => {
        const result = await client
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId);
        if (result.error) throw result.error;
        return [table, result.count ?? 0] as const;
      }),
    );
    const { data: events, error } = await client
      .from('events')
      .select('id, event_type, occurred_at')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(10);
    if (error) throw error;

    return {
      companyId,
      counts: Object.fromEntries(countEntries) as CompanySummary['counts'],
      recentEvents: ((events ?? []) as DatabaseRow[]).map((event) => ({
        id: String(event.id),
        eventType: String(event.event_type),
        occurredAt: String(event.occurred_at),
      })),
    };
  }

  async listResource(companyId: string, resource: string): Promise<Array<Record<string, unknown>>> {
    const resourceTables: Record<string, string> = {
      roles: 'roles',
      employees: 'employees',
      missions: 'missions',
      projects: 'projects',
      tasks: 'tasks',
      channels: 'channels',
      messages: 'messages',
      threads: 'threads',
      events: 'events',
      notifications: 'notifications',
      integrations: 'integrations',
      'ai-providers': 'ai_providers',
      'orchestration-runs': 'orchestration_runs',
    };
    const table = resourceTables[resource];
    if (!table) throw new Error(`Unsupported company resource: ${resource}`);
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('company_id', companyId)
      .limit(100);
    if (error) throw error;
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async appendEvent(input: {
    companyId: string;
    actorUserId?: string;
    eventType: string;
    entityType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }): Promise<string> {
    const client = requireAdmin(this.admin);
    const { data, error } = await client
      .from('events')
      .insert({
        company_id: input.companyId,
        actor_user_id: input.actorUserId ?? null,
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        payload: input.payload ?? {},
      })
      .select('id')
      .single();
    if (error) throw error;
    return String(data.id);
  }

  async getTelegramMembership(telegramUserId: number): Promise<CompanyMembership | null> {
    const client = requireAdmin(this.admin);
    const { data: authorization, error: authorizationError } = await client
      .from('telegram_authorizations')
      .select('company_id, companies!inner(name)')
      .eq('telegram_user_id', telegramUserId)
      .eq('active', true)
      .maybeSingle();
    if (authorizationError) throw authorizationError;
    if (!authorization) return null;

    const row = authorization as DatabaseRow;
    const company = row.companies as DatabaseRow | null;
    const { data: membership, error: membershipError } = await client
      .from('company_memberships')
      .select('role')
      .eq('company_id', String(row.company_id))
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!company || !membership) return null;
    return {
      companyId: String(row.company_id),
      companyName: String(company.name),
      membershipRole: String(membership.role ?? 'member'),
    };
  }
}
