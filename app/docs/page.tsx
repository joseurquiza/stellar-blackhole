import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  GitBranch,
  KeyRound,
  Layers,
  Network,
  CircleAlert,
  Workflow,
  Boxes,
  Map as MapIcon,
} from "lucide-react"

const PAGE_URL = "https://www.action-tokens.com/docs"
const TITLE = "Stellar BlackHole — Technical Architecture"
const DESCRIPTION =
  "Technical architecture of Stellar BlackHole: a fully non-custodial, client-side tool that audits a Stellar account, builds a verifiable demolition plan, and merges the account to reclaim locked XLM reserves. Keys never leave the browser."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

const SECTIONS = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "Problem statement" },
  { id: "principles", label: "Design principles" },
  { id: "overview", label: "System overview" },
  { id: "pipeline", label: "Execution pipeline" },
  { id: "engine", label: "Core engine" },
  { id: "security", label: "Security model" },
  { id: "safety", label: "Trust & safety" },
  { id: "networks", label: "Networks & infrastructure" },
  { id: "stack", label: "Technology stack" },
  { id: "roadmap", label: "Roadmap" },
]

export default function ArchitecturePage() {
  return (
    <div className="demolish-theme min-h-screen bg-background text-foreground">
      {/* supernova shockwave band */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--nova-shock)) 20%, hsl(var(--nova-core)) 50%, hsl(var(--nova-shock)) 80%, transparent 100%)",
        }}
        aria-hidden
      />

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Title block */}
        <header className="mb-10 max-w-3xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Stellar BlackHole
          </Link>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Technical Architecture Document
          </p>
          <h1 className="text-pretty text-4xl font-bold tracking-tight sm:text-5xl">Stellar BlackHole</h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            A fully non-custodial, browser-resident engine that audits a Stellar account, builds a
            cryptographically-faithful demolition plan, and merges the account to reclaim its locked XLM reserves —
            without a backend ever touching a private key.
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Document version</dt>
              <dd className="font-medium">1.0</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-medium">Stellar (Public Mainnet + Testnet)</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Custody model</dt>
              <dd className="font-medium">Non-custodial / client-side</dd>
            </div>
          </dl>
        </header>

        <div className="gap-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Table of contents */}
          <aside className="mb-10 lg:mb-0">
            <nav aria-label="Table of contents" className="lg:sticky lg:top-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
              <ol className="space-y-1.5 text-sm">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex gap-2 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <span className="tabular-nums text-primary/60">{String(i + 1).padStart(2, "0")}</span>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          {/* Body */}
          <div className="max-w-3xl space-y-14">
            <Section id="abstract" icon={Layers} title="1. Abstract">
              <p>
                Stellar BlackHole is a single-page web application that performs the complete, irreversible lifecycle of
                closing a Stellar account: it reads the account&apos;s on-chain state, identifies every subentry and
                balance that would block an <Code>ACCOUNT_MERGE</Code>, generates an ordered set of transactions to
                clear them, and finally merges the account so the user recovers all remaining XLM — including the{" "}
                <Em>base reserve</Em> and per-subentry reserves that are otherwise permanently locked.
              </p>
              <p>
                The defining property of the system is that it is <Em>fully non-custodial</Em>. All account analysis,
                transaction construction, signing, and submission happen inside the user&apos;s browser tab. Secret keys
                exist only as in-memory <Code>Keypair</Code> objects for the lifetime of the signing step and are never
                transmitted, logged, or persisted.
              </p>
            </Section>

            <Section id="problem" icon={CircleAlert} title="2. Problem statement">
              <p>
                Every Stellar account must hold a minimum XLM balance proportional to the number of subentries it owns —
                trustlines, open DEX offers, data entries, additional signers, and liquidity-pool stakes each lock{" "}
                <Code>0.5 XLM</Code>, on top of a <Code>1 XLM</Code> base reserve. Users routinely accumulate dozens of
                dormant trustlines and offers, stranding XLM they cannot withdraw with a normal wallet send.
              </p>
              <p>
                Reclaiming that value requires a precise, ordered teardown: you cannot remove a trustline that still
                holds a balance, cannot merge an account that still sponsors reserves for others, and cannot merge while
                offers lock liabilities. Doing this by hand is error-prone and irreversible. BlackHole encodes the
                correct ordering and the protocol-level constraints into a guided, verifiable pipeline.
              </p>
            </Section>

            <Section id="principles" icon={ShieldCheck} title="3. Design principles">
              <ul className="space-y-3">
                <Bullet term="Non-custodial by construction">
                  There is no server-side key handling. The application is a static client; the only network calls are
                  to public Stellar infrastructure (Horizon).
                </Bullet>
                <Bullet term="What you preview is what you sign">
                  The preview and the executor are derived from the same data structure (<Code>DemolitionUnit</Code>),
                  which couples each human-readable step to the exact SDK operations submitted on chain. There is no
                  separate &quot;build&quot; path that could diverge from what the user approved.
                </Bullet>
                <Bullet term="Fail-safe execution">
                  Transactions run in order and execution halts on the first failure, so no irreversible operation (the
                  merge) can run after an unexpected error in an earlier cleanup step.
                </Bullet>
                <Bullet term="Rehearsable">
                  Every flow runs identically on Testnet, letting users rehearse the exact irreversible sequence before
                  committing real mainnet funds.
                </Bullet>
              </ul>
            </Section>

            <Section id="overview" icon={Boxes} title="4. System overview">
              <p>
                The application is organized into a thin presentation layer (a six-stage wizard) over a pure,
                framework-agnostic <Em>engine</Em> located in <Code>lib/stellar/</Code>. The engine has no React
                dependencies and could be reused by a CLI or a different frontend.
              </p>
              <CodeBlock>
                {`app/page.tsx                   UI route (wizard + SEO/JSON-LD)
components/demolish/
  use-demolisher.ts            React state machine orchestrating the 6 stages
  live-wizard.tsx              Stage rendering, confirmation gating
  audit/configure/preview/…    Per-stage panels
lib/stellar/                   Pure engine (no React)
  network.ts                   Network configs, explorer URLs, asset helpers
  types.ts                     Domain model (AccountAudit, Plan, Config, …)
  account.ts                   Horizon audit loader + Soroban discovery
  analysis.ts                  StrKey validation, blockers, warnings
  routing.ts                   SDEX/AMM strict-send path quoting
  soroban.ts                   Keyless contract discovery + RPC token reads
  defiAdapters.ts              Pluggable protocol-position adapter registry
  plan.ts                      Demolition unit builder + tx batching
  signing.ts                   In-memory keypair signing + multisig weight
  execute.ts                   Sequential submit, fail-safe, result codes`}
              </CodeBlock>
              <p>
                The React layer (<Code>useDemolisher</Code>) holds transient UI state and delegates every on-chain
                decision to the engine. Secret keys are held in React state only for the signing step and cleared on{" "}
                <Code>reset()</Code>.
              </p>
            </Section>

            <Section id="pipeline" icon={Workflow} title="5. Execution pipeline">
              <p>The user moves through six deterministic stages. Each stage is a pure function of the previous one:</p>
              <ol className="space-y-4">
                <Step n={1} title="Connect">
                  The user selects a network (Testnet/Public) and provides a public key (<Code>G…</Code>), validated
                  with <Code>StrKey.isValidEd25519PublicKey</Code>. No secret is requested here.
                </Step>
                <Step n={2} title="Audit">
                  <Code>loadAccountAudit()</Code> reads the full classic state from Horizon and computes the minimum
                  reserve, multisig status, and per-entry liabilities.
                </Step>
                <Step n={3} title="Configure">
                  The user chooses the merge destination, optional mediator routing (for exchange deposits with memos),
                  whether to auto-sell non-XLM assets to a base asset, slippage tolerance, and which cleanup classes to
                  include.
                </Step>
                <Step n={4} title="Preview (dry-run)">
                  <Code>buildDemolitionPlan()</Code> resolves DEX path quotes up front and produces the exact ordered
                  transactions, an estimate of recoverable XLM, hard blockers, and warnings. Nothing is sent.
                </Step>
                <Step n={5} title="Execute">
                  After a type-to-confirm gate, secret keys are loaded into memory and each transaction is signed and
                  submitted in order, with live per-transaction status.
                </Step>
                <Step n={6} title="Result">
                  Success surfaces the destination on a block explorer; failure reports the parsed Horizon result codes
                  and guarantees no further transactions ran.
                </Step>
              </ol>
            </Section>

            <Section id="engine" icon={GitBranch} title="6. Core engine">
              <SubHeading icon={Search}>6.1 Audit (account.ts)</SubHeading>
              <p>
                A single <Code>loadAccount</Code> call plus paginated <Code>offers()</Code> and{" "}
                <Code>claimableBalances()</Code> queries reconstruct the account&apos;s subentry graph. The minimum
                balance is computed directly from protocol rules:
              </p>
              <CodeBlock>{`minBalance = (2 + subentryCount + numSponsoring − numSponsored) × 0.5 XLM`}</CodeBlock>
              <p>
                The loader also summarizes claimable-balance predicates into a human-readable form and a best-effort
                &quot;claimable now&quot; boolean, and flags multisig and disabled-master-key configurations. After the
                classic graph is reconstructed, it invokes the keyless Soroban discovery layer (§6.4) as a best-effort
                step — failures there are swallowed so they can never block or invalidate the classic audit. Discovered
                Soroban tokens and DeFi positions are surfaced for review rather than auto-liquidated in this phase.
              </p>

              <SubHeading icon={CircleAlert}>6.2 Analysis (analysis.ts)</SubHeading>
              <p>
                Validation uses the SDK&apos;s <Code>StrKey</Code> for public, secret, and muxed (<Code>M…</Code>)
                addresses. <Code>computeBlockers()</Code> produces hard stops that gate execution entirely — most
                importantly <Code>numSponsoring &gt; 0</Code>, since Stellar rejects a merge while the account sponsors
                reserves for others. <Code>computeWarnings()</Code> produces non-fatal advisories (multisig thresholds,
                disabled master key, time-locked claimable balances, detected Soroban/DeFi positions).
              </p>

              <SubHeading icon={Network}>6.3 Routing (routing.ts)</SubHeading>
              <p>
                To empty non-XLM balances before merge, the engine queries Horizon&apos;s{" "}
                <Code>strictSendPaths</Code> over the SDEX and AMMs, selects the path with the highest destination
                amount, and converts the configured slippage (in basis points) into a <Code>destMin</Code> guard on the
                resulting path-payment. Assets with no available route are reported and left in place rather than
                forcing an unsafe operation.
              </p>

              <SubHeading icon={Boxes}>6.4 Soroban discovery (soroban.ts, defiAdapters.ts)</SubHeading>
              <p>
                Classic Horizon cannot enumerate which Soroban contracts an account has interacted with, and commercial
                indexers (OctoPos, Orion) gate their APIs behind requested keys. BlackHole instead reconstructs this
                itself, fully <Em>keyless</Em>, in two stages:
              </p>
              <ol className="space-y-4">
                <Step n={1} title="Discover">
                  <Code>discoverInvokedContracts()</Code> pages the account&apos;s{" "}
                  <Code>invoke_host_function</Code> operation history on public Horizon and extracts every contract
                  address referenced — both from the operation <Code>parameters</Code> (decoded <Code>ScVal</Code>{" "}
                  addresses) and from the <Code>asset_balance_changes</Code> ledger effects.
                </Step>
                <Step n={2} title="Read">
                  Each candidate (capped at <Code>40</Code>, deduped, user-pasted ids first) is probed via the public
                  Soroban RPC with batched, bounded-concurrency <Code>simulateTransaction</Code> calls to a token
                  contract&apos;s <Code>balance</Code>, <Code>symbol</Code>, <Code>name</Code>, and{" "}
                  <Code>decimals</Code>. Non-zero balances become <Code>SorobanTokenBalance</Code>s, labelled against a
                  small registry of verified mainnet addresses (Soroswap, Aquarius, the native SAC) when matched.
                </Step>
              </ol>
              <p>
                A pluggable <Code>defiAdapters</Code> registry layers protocol-specific position reads on top of the raw
                token scan, so deeper unwinding logic (e.g. Blend, Soroswap LP) can be added per protocol without
                touching the discovery core. Every contract that is discovered but not recognized is still surfaced as a
                token rather than mislabeled.
              </p>

              <SubHeading icon={Layers}>6.5 Planning (plan.ts)</SubHeading>
              <p>
                The planner emits an ordered list of <Code>DemolitionUnit</Code>s, each pairing a preview description
                with the concrete <Code>xdr.Operation[]</Code> that will be signed. The canonical order respects every
                protocol dependency:
              </p>
              <CodeBlock>{`1. Withdraw liquidity-pool shares
2. Claim claimable balances (claimable now)
3. Cancel open offers (release locked liabilities)
4. Sell non-XLM balances → base asset (strict-send path payment)
5. Remove emptied trustlines        (reclaims 0.5 XLM each)
6. Remove data entries              (reclaims 0.5 XLM each)
7. Remove additional signers        (reclaims 0.5 XLM each)
8. Optional: route XLM through a mediator (exchange deposits)
9. ACCOUNT_MERGE — always the final operation, irreversible`}</CodeBlock>
              <p>
                Units are packed into valid transactions of at most <Code>95</Code> operations, with the optional
                mediator payment and the merge kept together in the final transaction. Estimated recovered XLM is the
                spendable balance plus the sum of reserves reclaimed by each unit.
              </p>

              <SubHeading icon={KeyRound}>6.6 Signing (signing.ts)</SubHeading>
              <p>
                <Code>createSignerSet()</Code> validates raw secret seeds and converts them into in-memory{" "}
                <Code>Keypair</Code> objects. An optional external signer interface allows a connected wallet to return a
                signed XDR instead, so hardware/extension wallets can participate without exposing a seed.{" "}
                <Code>availableWeight()</Code> pre-computes the combined signing weight against the account&apos;s signer
                list so the UI can block execution early when a multisig high threshold cannot be met.
              </p>

              <SubHeading icon={Workflow}>6.7 Execution (execute.ts)</SubHeading>
              <p>
                Each transaction is rebuilt from a freshly loaded sequence number, signed in memory, and submitted to
                Horizon with a fee of <Code>0.001 XLM</Code> per operation and a 180-second timeout. If any submission
                fails, the executor parses Horizon&apos;s <Code>result_codes</Code>, marks the step failed, and{" "}
                <Em>returns immediately</Em> — guaranteeing the irreversible merge never runs after an error.
              </p>
            </Section>

            <Section id="security" icon={KeyRound} title="7. Security model">
              <ul className="space-y-3">
                <Bullet term="No backend custody">
                  The app has no server endpoint that receives keys or signs transactions. Signing is performed locally
                  with the Stellar SDK.
                </Bullet>
                <Bullet term="In-memory key lifetime">
                  Secret seeds live only inside <Code>Keypair</Code> objects during the signing step and are discarded
                  on completion or reset. They are never written to storage, cookies, or logs.
                </Bullet>
                <Bullet term="Optional wallet signing">
                  The external-signer interface supports delegating signatures to a connected wallet, eliminating raw
                  seed entry entirely.
                </Bullet>
                <Bullet term="Public-key-only audit">
                  The entire audit, planning, and preview flow requires only a public key. A secret is requested solely
                  at the final signing step.
                </Bullet>
                <Bullet term="Direct-to-Horizon trust boundary">
                  The only external dependency is Stellar&apos;s public Horizon API; there is no intermediary service to
                  trust or compromise.
                </Bullet>
              </ul>
            </Section>

            <Section id="safety" icon={ShieldCheck} title="8. Trust & safety">
              <ul className="space-y-3">
                <Bullet term="Mandatory dry-run">
                  Users always see the exact ordered plan, recoverable-XLM estimate, blockers, and warnings before any
                  transaction can be built into a signing flow.
                </Bullet>
                <Bullet term="Hard blockers gate execution">
                  Conditions such as active sponsorships or an unfunded account disable the demolish action entirely
                  until resolved.
                </Bullet>
                <Bullet term="Explicit confirmation">
                  Execution requires typing <Code>DEMOLISH</Code>, with an extra warning when operating on Public
                  mainnet.
                </Bullet>
                <Bullet term="Testnet rehearsal">
                  The identical pipeline runs on Testnet so the irreversible sequence can be validated risk-free.
                </Bullet>
              </ul>
            </Section>

            <Section id="networks" icon={Network} title="9. Networks & infrastructure">
              <p>
                Both Stellar Public Mainnet and Testnet are first-class, configured with their Horizon endpoints,
                Soroban RPC endpoints, network passphrases, and{" "}
                <a
                  href="https://stellar.expert"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  stellar.expert
                </a>{" "}
                explorer bases. Switching networks is a single state change that re-points every engine call; there is
                no separate code path per network.
              </p>
            </Section>

            <Section id="stack" icon={Boxes} title="10. Technology stack">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-border">
                    <Row k="Framework" v="Next.js 16 (App Router) · React 19 · TypeScript" />
                    <Row k="Stellar" v="@stellar/stellar-sdk 15 · Horizon REST · Soroban RPC · SDEX/AMM path-finding" />
                    <Row k="Wallets" v="@creit.tech/stellar-wallets-kit (optional external signing)" />
                    <Row k="UI" v="Tailwind CSS · shadcn/ui · lucide-react · scoped supernova theme" />
                    <Row k="Assistant" v="Vercel AI SDK 6 (in-app support agent)" />
                    <Row k="Hosting" v="Vercel · static client execution (no server key handling)" />
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="roadmap" icon={MapIcon} title="11. Roadmap">
              <ul className="space-y-3">
                <Bullet term="Soroban liquidation">
                  Keyless Soroban token and DeFi discovery is live (§6.4); the next step is promoting detected balances
                  into automated liquidation and unwinding before merge.
                </Bullet>
                <Bullet term="Expanded protocol registry">
                  Grow the verified-address registry and per-protocol <Code>defiAdapters</Code> beyond Soroswap and
                  Aquarius to deeply read and unwind Blend, Phoenix, and other Soroban positions.
                </Bullet>
                <Bullet term="Batch / portfolio mode">
                  Audit and demolish multiple accounts in one guided session.
                </Bullet>
                <Bullet term="Sponsorship revocation flow">
                  Guided resolution of the active-sponsorship blocker directly inside the tool.
                </Bullet>
              </ul>
            </Section>

            <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
              <p>
                Stellar BlackHole is part of the Action Tokens platform.{" "}
                <Link href="/" className="text-primary hover:underline">
                  Open the tool
                </Link>
                .
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        {title}
      </h2>
      <div className="space-y-4 leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  )
}

function SubHeading({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 pt-3 text-base font-semibold text-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {children}
    </h3>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
  )
}

function Em({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-foreground/90">
      <code className="font-mono">{children}</code>
    </pre>
  )
}

function Bullet({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <span>
        <Em>{term}.</Em> {children}
      </span>
    </li>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 font-mono text-sm font-semibold text-primary">
        {n}
      </span>
      <span className="pt-1">
        <Em>{title}.</Em> {children}
      </span>
    </li>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th scope="row" className="w-40 bg-card px-4 py-3 align-top font-medium text-foreground">
        {k}
      </th>
      <td className="px-4 py-3 text-muted-foreground">{v}</td>
    </tr>
  )
}
