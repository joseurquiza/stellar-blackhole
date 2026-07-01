import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "API Docs — Stellar BlackHole",
  description:
    "Integrate Stellar BlackHole into your platform: a non-custodial REST API and embeddable widget that lets your users close and merge their Stellar accounts without leaving your app.",
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-xs leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  )
}

function Endpoint({ method, path, children }: { method: string; path: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold uppercase text-primary">
          {method}
        </span>
        <code className="font-mono text-sm">{path}</code>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Stellar BlackHole
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-balance">Integrate BlackHole into your platform</h1>
      <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
        Let your Stellar users close and merge their accounts — reclaiming locked XLM reserves — without ever leaving
        your product. Use the REST API to build your own flow, or drop in the embeddable widget for a turnkey UI.
      </p>

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">Non-custodial by design.</span> The API returns{" "}
          <em>unsigned</em> transaction envelopes; your user signs them with their own wallet. Secret keys never reach
          BlackHole&apos;s servers. With the widget, keys stay inside the BlackHole iframe and are invisible even to your
          page.
        </p>
      </div>

      {/* Auth */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Authentication</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every request needs an API key, sent as a bearer token. Create and manage keys in the{" "}
          <Link href="/developers" className="text-primary underline underline-offset-2">
            developer console
          </Link>
          . Keys can be scoped to an origin allowlist and rate-limited per minute.
        </p>
        <Code>{`Authorization: Bearer bh_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
      </section>

      {/* Flow */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">The flow</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <code className="font-mono">POST /api/v1/audit</code> — inspect the account (balances, trustlines, blockers).
          </li>
          <li>
            <code className="font-mono">POST /api/v1/plan</code> — get the ordered list of unsigned transaction XDRs.
          </li>
          <li>Your user signs each envelope in order with their wallet (Freighter, Albedo, hardware, etc.).</li>
          <li>
            Submit each signed envelope to Horizon yourself, or relay it through{" "}
            <code className="font-mono">POST /api/v1/submit</code>.
          </li>
        </ol>
      </section>

      {/* Endpoints */}
      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Endpoints</h2>
        <p className="text-sm text-muted-foreground">
          Base URL: <code className="font-mono">/api/v1</code>. All POST bodies are JSON.
        </p>

        <Endpoint method="post" path="/api/v1/audit">
          <p>Read-only inspection of an account.</p>
          <Code>{`curl -X POST https://YOUR_DOMAIN/api/v1/audit \\
  -H "Authorization: Bearer $BLACKHOLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "publicKey": "G...", "network": "public" }'`}</Code>
        </Endpoint>

        <Endpoint method="post" path="/api/v1/plan">
          <p>
            Builds the demolition plan and returns unsigned transaction envelopes to sign in order. At minimum pass{" "}
            <code className="font-mono">publicKey</code> and <code className="font-mono">destinationAddress</code>.
          </p>
          <Code>{`curl -X POST https://YOUR_DOMAIN/api/v1/plan \\
  -H "Authorization: Bearer $BLACKHOLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "publicKey": "G...SOURCE",
    "destinationAddress": "G...DEST",
    "network": "public",
    "sellToBase": true,
    "claimBalances": true,
    "withdrawPools": true,
    "slippageBps": 100
  }'

// response
{
  "estimatedRecoveredXlm": "12.5000000",
  "blockers": [],
  "warnings": [],
  "preview": [ { "label": "Cleanup transaction 1", "operations": [ ... ] } ],
  "transactions": [
    { "index": 0, "label": "Cleanup transaction 1", "opCount": 4, "xdr": "AAAA..." },
    { "index": 1, "label": "Account merge · stamped \\"via BlackHole\\"", "opCount": 1, "xdr": "AAAA..." }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="post" path="/api/v1/submit">
          <p>Optional relay: forward an already-signed envelope to Horizon.</p>
          <Code>{`curl -X POST https://YOUR_DOMAIN/api/v1/submit \\
  -H "Authorization: Bearer $BLACKHOLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "signedXdr": "AAAA...", "network": "public" }'

// response
{ "hash": "abc123...", "ledger": 51234567, "successful": true, "explorerUrl": "https://stellar.expert/..." }`}</Code>
        </Endpoint>

        <Endpoint method="get" path="/api/v1/networks">
          <p>Lists supported networks and passphrases. Handy for verifying a key.</p>
          <Code>{`curl https://YOUR_DOMAIN/api/v1/networks -H "Authorization: Bearer $BLACKHOLE_KEY"`}</Code>
        </Endpoint>
      </section>

      {/* Widget */}
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Embeddable widget</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Prefer a turnkey UI? Drop in the widget script and mount it into any element. The full cleanup + merge flow
          runs in a sandboxed iframe on BlackHole&apos;s origin, so your users never leave your page and their keys never
          touch it. The iframe auto-resizes and emits lifecycle events.
        </p>
        <Code>{`<div id="blackhole"></div>

<script src="https://YOUR_DOMAIN/blackhole-widget.js"></script>
<script>
  BlackHole.mount('#blackhole', {
    network: 'public',
    onReady:    () => console.log('widget ready'),
    onStage:    (stage) => console.log('stage:', stage),
    onComplete: () => console.log('account merged'),
  })
</script>`}</Code>
        <p className="text-sm leading-relaxed text-muted-foreground">Or auto-initialize with data attributes:</p>
        <Code>{`<div id="blackhole"></div>
<script src="https://YOUR_DOMAIN/blackhole-widget.js"
        data-blackhole data-target="#blackhole" data-network="public"></script>`}</Code>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Errors &amp; limits</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Errors return <code className="font-mono">{`{ "error": { "code", "message" } }`}</code> with an appropriate
          HTTP status: <code className="font-mono">401</code> invalid key, <code className="font-mono">403</code> origin
          not allowed, <code className="font-mono">429</code> rate limited, <code className="font-mono">400</code>{" "}
          validation. CORS is enabled so browser and widget calls work from allowlisted origins.
        </p>
      </section>
    </main>
  )
}
