import { HelpCircle } from "lucide-react"

/**
 * Single source of truth for Stellar BlackHole's answer-engine content.
 * Both the visible FAQ section (below) and the FAQPage JSON-LD in
 * app/page.tsx consume this array, so they never drift apart.
 * Answers are written as concise, self-contained answers — the format
 * answer engines (ChatGPT, Perplexity, Google AI Overviews, Gemini) prefer.
 */
export const demolishFaq: { question: string; answer: string }[] = [
  {
    question: "What is Stellar BlackHole?",
    answer:
      "Stellar BlackHole is a free, non-custodial web tool that audits a Stellar account and guides you through closing it down — removing trustlines, canceling DEX offers, withdrawing liquidity, selling non-XLM assets, and finally merging the account to reclaim your locked XLM reserves. All transactions are signed in your browser; your secret keys are never sent to any server.",
  },
  {
    question: "What does it mean to \"spaghettify your wallet\"?",
    answer:
      "Spaghettification is the astrophysics term for what a black hole's tidal forces do to anything that falls in: it stretches matter into a long, thin stream until nothing structured is left. Stellar BlackHole borrows the metaphor for closing an account — it pulls your wallet apart sub-entry by sub-entry, in order: canceling DEX offers, withdrawing liquidity, selling non-XLM assets, deleting data entries, and removing trustlines, until only native XLM remains. The final ACCOUNT_MERGE then collapses what's left and returns your locked XLM reserves. It's a vivid way of describing a careful, fully non-custodial teardown.",
  },
  {
    question: "How do I close a Stellar account and get my XLM back?",
    answer:
      "To close a Stellar account you must first remove every sub-entry it holds: cancel open DEX offers, withdraw from liquidity pools, sell or transfer non-XLM balances, delete data entries, and remove trustlines. Once the account holds only native XLM, you run the ACCOUNT_MERGE operation to a destination account. This transfers the remaining balance and reclaims the base reserve. Stellar BlackHole builds this exact ordered plan for you and shows it as a dry-run before you sign.",
  },
  {
    question: "Is Stellar BlackHole non-custodial and safe to use?",
    answer:
      "Yes. Stellar BlackHole is fully non-custodial: signing happens entirely client-side in your browser tab, and secret keys are kept in memory only — never serialized, logged, or transmitted to a server. It also includes a Testnet rehearsal mode, per-step irreversible-action warnings, and a typed confirmation gate before any account merge.",
  },
  {
    question: "Why can't I merge my Stellar account?",
    answer:
      "A Stellar account cannot be merged while it still has sub-entries or unmet obligations. The most common blockers are: existing trustlines, open DEX offers, stored data entries, liquidity-pool shares, and unmet multisig thresholds. A hard blocker is sponsoring reserves for other accounts — you must revoke those sponsorships first. Stellar BlackHole audits the account and lists every blocker before you proceed.",
  },
  {
    question: "What is a Stellar account merge?",
    answer:
      "An account merge is the Stellar ACCOUNT_MERGE operation, which permanently deletes an account and transfers its entire remaining native XLM balance to a chosen destination account. Merging reclaims the 1 XLM base reserve plus the 0.5 XLM held for each sub-entry, so it is how users recover the XLM that was locked as reserves.",
  },
  {
    question: "Can I rehearse a demolition before doing it on mainnet?",
    answer:
      "Yes. Stellar BlackHole has a Public/Testnet network toggle. You can fund a Stellar testnet account, add the same trustlines, offers, and data entries, then run the full preview, sign, and execute flow on Testnet to confirm the outcome before performing the irreversible merge on the public network.",
  },
  {
    question: "Does Stellar BlackHole support multisig Stellar accounts?",
    answer:
      "Yes. The tool parses the account's signers, weights, and thresholds, computes which keys are required to satisfy the high threshold needed for a merge, and lets you add multiple secret keys until enough signing weight is gathered before submitting each transaction.",
  },
  {
    question: "How does it handle trustlines and non-XLM token balances?",
    answer:
      "Before merging, Stellar BlackHole sells non-XLM classic assets to a base asset using native path payments over Stellar's SDEX and AMM order books, then removes the now-empty trustlines. Soroban token balances and DeFi positions are discovered keylessly — we scan the account's invoke-host-function history on public Horizon to enumerate every contract it has touched, then read live balances and labels (Soroswap, Aquarius, and more) directly from the public Soroban RPC. No external indexer or API key is required, and positions are surfaced as a read-only Preview to close in their source protocol.",
  },
]

export function DemolishFaq() {
  return (
    <section aria-labelledby="demolish-faq-heading" className="mt-14 border-t pt-10">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <h2 id="demolish-faq-heading" className="text-xl font-bold tracking-tight text-balance">
          Frequently asked questions
        </h2>
      </div>

      <div className="space-y-6">
        {demolishFaq.map((item) => (
          <article key={item.question} className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold leading-snug text-card-foreground text-pretty">{item.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
