"use client"

import { useActionState, useState } from "react"
import { createKeyAction, toggleKeyAction, deleteKeyAction } from "@/app/developers/actions"
import type { ApiKeyRow } from "@/lib/api/keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, AlertCircle, KeyRound, Trash2, Power } from "lucide-react"

export function KeyManager({ keys }: { keys: ApiKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createKeyAction, {})
  const [copied, setCopied] = useState(false)

  const copyKey = async () => {
    if (!state?.rawKey) return
    await navigator.clipboard.writeText(state.rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create an API key</CardTitle>
          <CardDescription>
            Issue a key for a partner platform. Set an origin allowlist for browser/widget use, or leave it empty for
            server-to-server calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state?.rawKey ? (
            <Alert className="border-primary/40 bg-primary/5">
              <KeyRound className="h-4 w-4 text-primary" />
              <AlertTitle>Copy this key now — it won&apos;t be shown again</AlertTitle>
              <AlertDescription>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{state.rawKey}</code>
                  <Button type="button" size="sm" variant="outline" onClick={copyKey}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Key name</Label>
                  <Input id="name" name="name" placeholder="Acme Wallet" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rateLimitPerMin">Rate limit (req/min)</Label>
                  <Input id="rateLimitPerMin" name="rateLimitPerMin" type="number" min={1} max={1000} defaultValue={60} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="allowedOrigins">Allowed origins (optional)</Label>
                <Textarea
                  id="allowedOrigins"
                  name="allowedOrigins"
                  placeholder={"https://app.acme.com\nhttps://acme.com"}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">One origin per line or comma-separated. Empty = any origin.</p>
              </div>
              {state?.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create key"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Existing keys ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No keys yet. Create one above to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <Badge variant={k.active ? "secondary" : "outline"} className="text-[10px]">
                      {k.active ? "Active" : "Revoked"}
                    </Badge>
                  </div>
                  <code className="text-xs text-muted-foreground">{k.key_prefix}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {k.rate_limit_per_min}/min ·{" "}
                    {k.allowed_origins.length ? `${k.allowed_origins.length} origin(s)` : "any origin"} ·{" "}
                    {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : "never used"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <input type="hidden" name="active" value={String(!k.active)} />
                    <Button type="submit" size="sm" variant="outline">
                      <Power className="mr-1.5 h-3.5 w-3.5" />
                      {k.active ? "Revoke" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
