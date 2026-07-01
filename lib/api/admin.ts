import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Minimal password-gated admin session for the developer key dashboard.
 *
 * The cookie value is an HMAC of a fixed marker keyed by BLACKHOLE_ADMIN_PASSWORD.
 * Only someone who knows the password can mint a valid cookie, and the password
 * itself is never stored in the cookie. This is intentionally lightweight — it
 * guards an internal operator page, not end-user accounts.
 */
const COOKIE = "bh_admin"
const MARKER = "blackhole-admin-v1"

function adminPassword(): string | null {
  const pw = process.env.BLACKHOLE_ADMIN_PASSWORD
  return pw && pw.length > 0 ? pw : null
}

export function isAdminConfigured(): boolean {
  return adminPassword() !== null
}

function sign(password: string): string {
  return createHmac("sha256", password).update(MARKER).digest("hex")
}

export function verifyPassword(candidate: string): string | null {
  const pw = adminPassword()
  if (!pw) return null
  const a = Buffer.from(candidate)
  const b = Buffer.from(pw)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return sign(pw)
}

export async function setAdminSession(token: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  })
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function isAdminAuthed(): Promise<boolean> {
  const pw = adminPassword()
  if (!pw) return false
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return false
  const expected = sign(pw)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
