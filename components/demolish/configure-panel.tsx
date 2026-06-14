"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { isValidDestination } from "@/lib/stellar/analysis"
import type { DemolitionConfig } from "@/lib/stellar/types"

type ConfigShape = Omit<DemolitionConfig, "publicKey" | "network">

export function ConfigurePanel({
  config,
  updateConfig,
  sorobanEnabled = false,
}: {
  config: ConfigShape
  updateConfig: (patch: Partial<ConfigShape>) => void
  sorobanEnabled?: boolean
}) {
  const destValid = config.destinationAddress === "" || isValidDestination(config.destinationAddress)
  const medValid = !config.useMediator || config.mediatorAddress === "" || isValidDestination(config.mediatorAddress ?? "")

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="destination">Final destination address</Label>
        <Input
          id="destination"
          placeholder="G... self-custodial wallet that receives the remaining XLM"
          value={config.destinationAddress}
          onChange={(e) => updateConfig({ destinationAddress: e.target.value.trim() })}
          className={!destValid ? "border-destructive" : ""}
        />
        {!destValid && <p className="text-xs text-destructive">Not a valid Stellar address.</p>}
        <p className="text-xs text-muted-foreground">
          All reclaimed XLM is transferred here when the account is merged. This is irreversible.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label>Sell all non-XLM balances first</Label>
          <p className="text-xs text-muted-foreground">Route each asset to XLM via the best on-chain path payment.</p>
        </div>
        <Switch checked={config.sellToBase} onCheckedChange={(v) => updateConfig({ sellToBase: v })} />
      </div>

      {config.sellToBase && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label>Slippage tolerance</Label>
            <span className="font-mono text-sm">{(config.slippageBps / 100).toFixed(2)}%</span>
          </div>
          <Slider
            value={[config.slippageBps]}
            min={10}
            max={500}
            step={10}
            onValueChange={([v]) => updateConfig({ slippageBps: v })}
          />
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label>Withdraw liquidity pools</Label>
          <p className="text-xs text-muted-foreground">Exit AMM positions to free their reserves before merge.</p>
        </div>
        <Switch checked={config.withdrawPools} onCheckedChange={(v) => updateConfig({ withdrawPools: v })} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label>Claim claimable balances</Label>
          <p className="text-xs text-muted-foreground">Claim everything that is unlocked now.</p>
        </div>
        <Switch checked={config.claimBalances} onCheckedChange={(v) => updateConfig({ claimBalances: v })} />
      </div>

      {sorobanEnabled && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Sweep Soroban positions before merge</Label>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Beta
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Withdraw Blend/Phoenix/Soroswap positions, transfer SAC &amp; Soroban token balances to your
                destination, and revoke dangling allowances. Value held in contracts is otherwise lost on merge.
              </p>
            </div>
            <Switch checked={config.sweepSoroban ?? false} onCheckedChange={(v) => updateConfig({ sweepSoroban: v })} />
          </div>
          {config.sweepSoroban && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Beta: Soroban contract calls are irreversible, and protocol adapters are still being hardened. On
                mainnet you must first rehearse this exact sweep in Simulate (or on testnet) before it can run.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Route through a mediator (for exchanges)</Label>
            <p className="text-xs text-muted-foreground">
              Most exchanges do not credit a raw account merge. Send XLM as a payment with a memo first.
            </p>
          </div>
          <Switch checked={config.useMediator} onCheckedChange={(v) => updateConfig({ useMediator: v })} />
        </div>

        {config.useMediator && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="mediator">Exchange deposit address</Label>
              <Input
                id="mediator"
                placeholder="G... exchange deposit public key"
                value={config.mediatorAddress}
                onChange={(e) => updateConfig({ mediatorAddress: e.target.value.trim() })}
                className={!medValid ? "border-destructive" : ""}
              />
              {!medValid && <p className="text-xs text-destructive">Not a valid Stellar address.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="memo">Deposit memo</Label>
              <Input
                id="memo"
                placeholder="Memo required by the exchange (max 28 chars)"
                value={config.mediatorMemo}
                onChange={(e) => updateConfig({ mediatorMemo: e.target.value })}
                maxLength={28}
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The mediator payment sends spendable XLM with your memo, then the account merge targets the same
                address to sweep the final base reserve.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  )
}
