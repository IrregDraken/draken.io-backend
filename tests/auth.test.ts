import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireMembership } from '../src/auth.js';

describe('company authorization', () => {
  it('allows a request whose authenticated context has the company membership', () => {
    const request = {
      context: {
        user: { id: 'user-1' },
        memberships: [{ companyId: 'company-1', companyName: 'Draken', membershipRole: 'member' }],
      },
    } as FastifyRequest;
    const reply = {} as FastifyReply;
    expect(requireMembership(request, reply, 'company-1')).toBe(true);
  });

  it('denies a request outside the authenticated user company memberships', () => {
    const send = vi.fn();
    const code = vi.fn(() => ({ send }));
    const request = {
      context: {
        user: { id: 'user-1' },
        memberships: [{ companyId: 'company-1', companyName: 'Draken', membershipRole: 'member' }],
      },
    } as FastifyRequest;
    const reply = { code } as unknown as FastifyReply;
    expect(requireMembership(request, reply, 'company-2')).toBe(false);
    expect(code).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({ error: 'company_access_denied' });
  });
});
