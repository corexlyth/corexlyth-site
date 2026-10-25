import { createClient } from '@supabase/supabase-js';
import { authConfigured, authUrl, authKey } from '../config/auth';
let client: ReturnType<typeof createClient> | undefined;
export function getAuthClient() {
  if (!authConfigured) return null;
  return client ??= createClient(authUrl, authKey, {
    auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
