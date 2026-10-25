import settings from './public-auth.json';
// Public client configuration only. Never place privileged keys here.
export const authUrl = import.meta.env.PUBLIC_SUPABASE_URL || settings.url;
export const authKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || settings.publishableKey;
if (authKey && !authKey.startsWith('sb_publishable_')) throw new Error('Only a Supabase publishable client key is accepted.');
if (authUrl && new URL(authUrl).protocol !== 'https:') throw new Error('Supabase client URL must use HTTPS.');
if (Boolean(authUrl) !== Boolean(authKey)) throw new Error('Both public Supabase settings must be configured together.');
export const authConfigured = Boolean(authUrl && authKey);

// Direct test routes remain usable while the general account menu stays closed.
export const authPublicLaunch = settings.publicLaunch === true;
