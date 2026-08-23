import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

export type SupabaseClients = {
  admin?: SupabaseClient;
  auth?: SupabaseClient;
  url?: string;
  anonKey?: string;
  configured: boolean;
};

export function createSupabaseClients(config: Config): SupabaseClients {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey)
    return { configured: false };
  return {
    configured: true,
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    auth: createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    admin: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export function createUserScopedClient(
  clients: SupabaseClients,
  accessToken: string,
): SupabaseClient {
  if (!clients.url || !clients.anonKey || !clients.configured)
    throw new Error('Supabase is not configured');
  return createClient(clients.url, clients.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
