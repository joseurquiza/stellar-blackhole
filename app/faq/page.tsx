import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, HelpCircle } from "lucide-react"
import { demolishFaq, DemolishFaq } from "@/components/demolish/demolish-faq"

const PAGE_URL = "https://www.action-tokens.com/faq"
const TITLE = "Stellar BlackHole — Frequently Asked Questions"
const DESCRIPTION =
  "Answers to common questions about closing and merging Stellar accounts with Stellar BlackHole: how account merge works, why a merge can be blocked, multisig support, trustlines and Soroban tokens, and non-custodial safety."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
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

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: demolishFaq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Stellar BlackHole", item: "https://www.action-tokens.com" },
      { "@type": "ListItem", position: 2, name: "FAQ", item: PAGE_URL },
    ],
  }

  return (
    <div className="demolish-theme min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* supernova shockwave band */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--nova-shock)) 20%, hsl(var(--nova-core)) 50%, hsl(var(--nova-shock)) 80%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Stellar BlackHole
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Frequently asked questions</h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Everything about closing a Stellar account, reclaiming locked XLM reserves, and how Stellar BlackHole keeps
            the process fully non-custodial.
          </p>
        </header>

        <DemolishFaq embedded />
      </div>
    </div>
  )
}
