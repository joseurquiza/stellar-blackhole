import type { Metadata } from "next"
import Link from "next/link"
import { isAdminAuthed, isAdminConfigured } from "@/lib/api/admin"
import { isDbConfigured } from "@/lib/db"
import { listApiKeys } from "@/lib/api/keys"
import { logoutAction } from "@/app/developers/actions"
import { LoginForm } from "@/components/developers/login-form"
import { KeyManager } from "@/components/developers/key-manager"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BookOpen, TriangleAlert } from "lucide-react"

export const metadata: Metadata = {
  title: "Developers — Stellar BlackHole API",
  description: "Manage API keys for the Stellar BlackHole public API and embeddable widget.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DevelopersPage() {
  if (!isDbConfigured() || !isAdminConfigured()) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16">
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Developer console not configured</AlertTitle>
          <AlertDescription>
            Set the <code className="font-mono">BLACKHOLE_ADMIN_PASSWORD</code> environment variable (and connect the
            database) to enable API key management.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const authed = await isAdminAuthed()
  if (!authed) return <LoginForm />

  const keys = await listApiKeys()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Developer console</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Issue and manage API keys for the public API and embeddable widget.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/developers/docs">
              <BookOpen className="mr-1.5 h-4 w-4" />
              API docs
            </Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <KeyManager keys={keys} />
    </main>
  )
}
