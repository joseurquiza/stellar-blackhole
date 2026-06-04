import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let adminInstance: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key.
 *
 * All agent data access goes through server routes with this client, which
 * bypasses RLS. The agent tables have RLS enabled with no public policies, so
 * they are not directly reachable by anon/authenticated browser clients.
 *
 * NEVER import this from a Client Component.
 */
export function getAdminSupabase(): SupabaseClient {
  if (adminInstance) return adminInstance

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase server env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    )
  }

  adminInstance = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminInstance
}
