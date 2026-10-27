import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnv } from './env'

export function createClient() {
  const env = getSupabasePublicEnv()
  if (!env) throw new Error('Supabase is not configured yet.')
  return createBrowserClient(env.url, env.publishableKey)
}
