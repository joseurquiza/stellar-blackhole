"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Coins, Layers, Gift, KeyRound, ShieldAlert, AlertTriangle } from "lucide-react"
import type { AccountAudit } from "@/lib/stellar/types"

function truncate(s: string, n = 8) {
  if (s.length <= n * 2 + 1) return s
  return `${s.slice(0, n)}…${s.slice(-4)}`
}

export function AuditDashboard({ audit }: { audit: AccountAudit }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="XLM Balance" value={Number.parseFloat(audit.nativeBalance).toFixed(4)} />
        <StatCard label="Min Reserve" value={Number.parseFloat(audit.minBalance).toFixed(2)} />
        <StatCard label="Subentries" value={String(audit.subentryCount)} />
        <StatCard
          label="Recoverable"
          value={(Number.parseFloat(audit.nativeBalance) - Number.parseFloat(audit.minBalance) + audit.subentryCount * 0.5 + 1).toFixed(2)}
          accent
        />
      </div>

      {audit.sponsorship.numSponsoring > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Merge blocked: active sponsorships</AlertTitle>
          <AlertDescription>
            This account sponsors {audit.sponsorship.numSponsoring} reserve(s) for other accounts. Stellar will reject
            the merge until every sponsorship you created is revoked.
          </AlertDescription>
        </Alert>
      )}

      {audit.isMultisig && (
        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Multisig account</AlertTitle>
          <AlertDescription>
            High threshold is {audit.thresholds.high}. You must provide enough signers to reach that weight before the
            merge can run.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="balances" className="gap-1.5">
            <Coins className="h-4 w-4 shrink-0" /> Balances
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5">
            <Layers className="h-4 w-4 shrink-0" /> Positions
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-1.5">
            <Gift className="h-4 w-4 shrink-0" /> Claims
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5">
            <KeyRound className="h-4 w-4 shrink-0" /> Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-2">
          {audit.balances.length === 0 && <Empty label="No balances" />}
          {audit.balances.map((b) => (
            <Row key={b.asset.key}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{b.asset.code}</span>
                {b.asset.isNative && <Badge variant="secondary">native</Badge>}
                {!b.asset.isNative && b.asset.issuer && (
                  <span className="text-xs text-muted-foreground">{truncate(b.asset.issuer)}</span>
                )}
              </div>
              <span className="font-mono text-sm">{Number.parseFloat(b.balance).toFixed(4)}</span>
            </Row>
          ))}
          {audit.sorobanTokens.map((t) => (
            <Row key={t.contractId}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.symbol ?? "Soroban token"}</span>
                <Badge variant="outline">Soroban</Badge>
                <span className="text-xs text-muted-foreground">{truncate(t.contractId)}</span>
              </div>
              <span className="font-mono text-sm">{t.displayBalance}</span>
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="positions" className="space-y-2">
          {audit.liquidityPools.length === 0 && audit.openOffers.length === 0 && audit.defiPositions.length === 0 && (
            <Empty label="No open positions" />
          )}
          {audit.liquidityPools.map((p) => (
            <Row key={p.poolId}>
              <span>Liquidity pool {truncate(p.poolId)}</span>
              <span className="font-mono text-sm">{Number.parseFloat(p.shares).toFixed(4)} shares</span>
            </Row>
          ))}
          {audit.openOffers.map((o) => (
            <Row key={o.id}>
              <span>
                Offer: sell {o.selling.code} → buy {o.buying.code}
              </span>
              <span className="font-mono text-sm">{Number.parseFloat(o.amount).toFixed(4)}</span>
            </Row>
          ))}
          {audit.defiPositions.map((d, i) => (
            <Row key={`${d.protocol}-${i}`}>
              <div className="flex items-center gap-2">
                <span>{d.protocol}</span>
                <Badge variant="outline">Preview</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{d.summary}</span>
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="claims" className="space-y-2">
          {audit.claimableBalances.length === 0 && <Empty label="No claimable balances" />}
          {audit.claimableBalances.map((c) => (
            <Row key={c.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {Number.parseFloat(c.amount).toFixed(4)} {c.asset.code}
                </span>
                {c.claimableNow ? (
                  <Badge variant="secondary">claimable</Badge>
                ) : (
                  <Badge variant="outline">locked</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{c.predicateSummary}</span>
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="access" className="space-y-3">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Signers & thresholds</h4>
            <div className="space-y-2">
              {audit.signers.map((s) => (
                <Row key={s.key}>
                  <span className="font-mono text-xs">{truncate(s.key)}</span>
                  <Badge variant="secondary">weight {s.weight}</Badge>
                </Row>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Thresholds — low {audit.thresholds.low}, med {audit.thresholds.med}, high {audit.thresholds.high}
            </p>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              Soroban allowances
              <Badge variant="outline">read-only</Badge>
            </h4>
            {audit.sorobanAllowances.length === 0 ? (
              <Empty label="No active allowances detected" />
            ) : (
              <div className="space-y-2">
                {audit.sorobanAllowances.map((a, i) => (
                  <Row key={`${a.contractId}-${i}`}>
                    <div className="flex flex-col">
                      <span className="text-sm">{a.symbol ?? truncate(a.contractId)}</span>
                      <span className="text-xs text-muted-foreground">
                        spender {a.spenderLabel ?? truncate(a.spender)}
                      </span>
                    </div>
                    <span className="font-mono text-sm">{a.amount}</span>
                  </Row>
                ))}
              </div>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              Allowances are shown for review. Revoke them in the granting app before abandoning this account.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 [&>*]:min-w-0 [&>span:last-child]:shrink-0">
      {children}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{label}</p>
}
