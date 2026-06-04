import type { Metadata } from "next"
import { Header } from "@/components/header"
import { demolishFaq } from "@/components/demolish/demolish-faq"

const PAGE_URL = "https://www.action-tokens.com/demolish"
const TITLE = "Stellar BlackHole — Non-Custodial Account Cleanup & Merge"
const DESCRIPTION =
  "A free, non-custodial tool to close a Stellar account: remove trustlines, cancel offers, sell assets, and merge the account to reclaim your locked XLM reserves. Keys never leave your browser. Testnet rehearsal included."

export const metadata: Metadata = {
  metadataBase: new URL("https://www.action-tokens.com"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Stellar account merge",
    "close Stellar account",
    "reclaim XLM reserve",
    "ACCOUNT_MERGE",
    "remove Stellar trustline",
    "non-custodial Stellar tool",
    "Stellar account cleanup",
    "delete Stellar account",
    "Stellar base reserve",
    "Soroban token",
  ],
  alternates: { canonical: PAGE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Action Tokens",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function DemolishLayout({ children }: { children: React.ReactNode }) {
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Stellar BlackHole",
    url: PAGE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web browser",
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Non-custodial client-side signing",
      "Stellar account audit (balances, trustlines, offers, liquidity pools, data entries, signers)",
      "Ordered dry-run demolition plan",
      "Path-payment selling of non-XLM assets",
      "Multisig signature gathering",
      "Testnet rehearsal mode",
      "ACCOUNT_MERGE to reclaim XLM reserves",
    ],
    publisher: { "@type": "Organization", name: "Action Tokens", url: "https://www.action-tokens.com" },
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: demolishFaq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to close a Stellar account and reclaim XLM reserves",
    description:
      "Audit a Stellar account, remove its sub-entries, and merge it to a destination account to recover the locked XLM base reserves.",
    tool: { "@type": "HowToTool", name: "Stellar BlackHole" },
    step: [
      { "@type": "HowToStep", name: "Connect", text: "Choose Public or Testnet and paste the account's public key." },
      { "@type": "HowToStep", name: "Audit", text: "Load the account's balances, trustlines, offers, liquidity pools, data entries, and signers." },
      { "@type": "HowToStep", name: "Configure", text: "Set the destination account and base asset, and select which claimable balances to claim." },
      { "@type": "HowToStep", name: "Preview", text: "Review the ordered, multi-transaction dry-run plan and its warnings." },
      { "@type": "HowToStep", name: "Sign", text: "Sign each transaction client-side with one or more secret keys, gathering enough weight for multisig." },
      { "@type": "HowToStep", name: "Execute", text: "Submit the transactions sequentially, ending with ACCOUNT_MERGE to reclaim the XLM reserves." },
    ],
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Action Tokens", item: "https://www.action-tokens.com" },
      { "@type": "ListItem", position: 2, name: "Stellar BlackHole", item: PAGE_URL },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="bg-black">
        <Header />
      </div>
      {children}
    </>
  )
}
