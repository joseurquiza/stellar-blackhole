import { neon } from "@neondatabase/serverless"

/**
 * Shared Neon SQL client for the public API's key + usage tables.
 *
 * Uses the tagged-template `sql` helper, which parameterizes every
 * interpolation — so all queries are injection-safe by construction.
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Surfaced at call time rather than import time so the rest of the app keeps
  // working even if the API is not configured.
  console.warn("[v0] DATABASE_URL is not set — the public API key store is unavailable.")
}

export const sql = neon(connectionString ?? "")

export function isDbConfigured(): boolean {
  return Boolean(connectionString)
}
