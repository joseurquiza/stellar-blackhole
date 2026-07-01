import type { Metadata } from "next"
import { EmbedFrame } from "@/components/embed/embed-frame"

// The embed is meant to be framed by partner sites, not indexed on its own.
export const metadata: Metadata = {
  title: "Stellar BlackHole — Embedded",
  robots: { index: false, follow: false },
}

export default function EmbedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <EmbedFrame />
    </main>
  )
}
