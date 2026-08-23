import type { SupabaseClients } from '../supabase.js';
import { createUserScopedClient } from '../supabase.js';

export class AuthService {
  constructor(private readonly clients: SupabaseClients) {}

  private requireAuthClient() {
    if (!this.clients.auth || !this.clients.configured)
      throw new Error('authentication_unconfigured');
    return this.clients.auth;
  }

  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
    username?: string;
  }) {
    const { data, error } = await this.requireAuthClient().auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error) throw new Error(error.message);
    if (data.user && this.clients.admin && (input.displayName || input.username)) {
      const { error: profileError } = await this.clients.admin.from('user_profiles').upsert({
        user_id: data.user.id,
        display_name: input.displayName ?? null,
        username: input.username ?? null,
      });
      if (profileError) throw profileError;
    }
    return { user: data.user, session: data.session };
  }

  async signIn(input: { email: string; password: string }) {
    const { data, error } = await this.requireAuthClient().auth.signInWithPassword(input);
    if (error) throw new Error(error.message);
    return { user: data.user, session: data.session };
  }

  async signOut(accessToken: string): Promise<void> {
    const { error } = await createUserScopedClient(this.clients, accessToken).auth.signOut({
      scope: 'local',
    });
    if (error) throw new Error(error.message);
  }

  async requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const { error } = await this.requireAuthClient().auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw new Error(error.message);
  }

  async getSession(accessToken: string) {
    const { data, error } = await createUserScopedClient(this.clients, accessToken).auth.getUser(
      accessToken,
    );
    if (error || !data.user) throw new Error(error?.message ?? 'invalid_bearer_token');
    return data.user;
  }

  async updateProfile(
    accessToken: string,
    input: { displayName?: string; username?: string; avatarUrl?: string },
  ) {
    const user = await this.getSession(accessToken);
    if (!this.clients.admin) throw new Error('authentication_unconfigured');
    const { data, error } = await this.clients.admin
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        display_name: input.displayName ?? null,
        username: input.username ?? null,
        avatar_url: input.avatarUrl ?? null,
      })
      .select('user_id, username, display_name, avatar_url')
      .single();
    if (error) throw error;
    return data;
  }
}
