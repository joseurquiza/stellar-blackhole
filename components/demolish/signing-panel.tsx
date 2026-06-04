"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react"
import type { AccountAudit } from "@/lib/stellar/types"

export function SigningPanel({
  audit,
  secretKeys,
  setSecretKeys,
  multisigWeight,
}: {
  audit: AccountAudit
  secretKeys: string[]
  setSecretKeys: (keys: string[]) => void
  multisigWeight: number
}) {
  const [reveal, setReveal] = useState<Record<number, boolean>>({})

  const updateKey = (i: number, val: string) => {
    const next = [...secretKeys]
    next[i] = val
    setSecretKeys(next)
  }
  const addKey = () => setSecretKeys([...secretKeys, ""])
  const removeKey = (i: number) => setSecretKeys(secretKeys.filter((_, idx) => idx !== i))

  const thresholdMet = !audit.isMultisig || multisigWeight >= audit.thresholds.high

  return (
    <div className="space-y-5">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Secret keys are used only in your browser to sign transactions and are never sent to any server.
        </AlertDescription>
      </Alert>

      {audit.isMultisig && (
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Multisig signing weight</span>
            <Badge variant={thresholdMet ? "secondary" : "destructive"}>
              {multisigWeight} / {audit.thresholds.high} required
            </Badge>
          </div>
          {!thresholdMet && (
            <p className="mt-2 text-xs text-destructive">
              Add more signing keys until the available weight reaches the high threshold.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          <Label>Secret keys</Label>
        </div>
        {secretKeys.map((key, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type={reveal[i] ? "text" : "password"}
              placeholder="S... secret key"
              value={key}
              onChange={(e) => updateKey(i, e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setReveal((r) => ({ ...r, [i]: !r[i] }))}
              aria-label={reveal[i] ? "Hide key" : "Show key"}
            >
              {reveal[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {secretKeys.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeKey(i)} aria-label="Remove key">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addKey}>
          <Plus className="mr-1 h-4 w-4" /> Add another key
        </Button>
        {audit.isMultisig && (
          <p className="text-xs text-muted-foreground">
            This account requires multiple signatures. Add each signer&apos;s secret key until the available weight
            meets the high threshold.
          </p>
        )}
      </div>
    </div>
  )
}
