import { createClient } from '@supabase/supabase-js';
import { authConfigured, authUrl, authKey } from '../config/auth';
let client: ReturnType<typeof createClient> | undefined;
export function getAuthClient() {
  if (!authConfigured) return null;
  if (client) return client;
  client = createClient(authUrl, authKey, {
    auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  client.auth.onAuthStateChange(event => {
    if (event !== 'SIGNED_OUT') return;
    try { for (const key of Object.keys(localStorage)) if (key.startsWith('cx-editor-recovery:v1:')) localStorage.removeItem(key); } catch { /* Device storage may be unavailable. */ }
  });
  return client;
}
