"use server"

import { revalidatePath } from "next/cache"
import {
  verifyPassword,
  setAdminSession,
  clearAdminSession,
  isAdminAuthed,
} from "@/lib/api/admin"
import { createApiKey, deleteApiKey, setApiKeyActive } from "@/lib/api/keys"

export async function loginAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "")
  const token = verifyPassword(password)
  if (!token) return { error: "Incorrect password." }
  await setAdminSession(token)
  revalidatePath("/developers")
  return {}
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession()
  revalidatePath("/developers")
}

export async function createKeyAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; rawKey?: string; prefix?: string }> {
  if (!(await isAdminAuthed())) return { error: "Not authorized." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Give the key a name." }

  const originsRaw = String(formData.get("allowedOrigins") ?? "").trim()
  const allowedOrigins = originsRaw
    ? originsRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const rateLimitPerMin = Math.max(1, Math.min(1000, Number(formData.get("rateLimitPerMin")) || 60))

  try {
    const { row, rawKey } = await createApiKey({ name, allowedOrigins, rateLimitPerMin })
    revalidatePath("/developers")
    return { rawKey, prefix: row.key_prefix }
  } catch (err: any) {
    return { error: err?.message ?? "Failed to create key." }
  }
}

export async function toggleKeyAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthed())) return
  const id = String(formData.get("id") ?? "")
  const active = String(formData.get("active") ?? "") === "true"
  if (id) {
    await setApiKeyActive(id, active)
    revalidatePath("/developers")
  }
}

export async function deleteKeyAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthed())) return
  const id = String(formData.get("id") ?? "")
  if (id) {
    await deleteApiKey(id)
    revalidatePath("/developers")
  }
}
