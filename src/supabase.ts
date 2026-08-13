import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

export type SupabaseClients = {
  admin?: SupabaseClient;
  auth?: SupabaseClient;
  configured: boolean;
};

export function createSupabaseClients(config: Config): SupabaseClients {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey) {
    return { configured: false };
  }

  return {
    configured: true,
    auth: createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    admin: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
