import { generateText } from "ai"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { accountData } = await req.json()

    if (!accountData) {
      return NextResponse.json({ error: "Missing account data parameters." }, { status: 400 })
    }

    const prompt = `
      You are an expert security auditor for the Stellar Network and Soroban ecosystem.
      Analyze the following Stellar account status data and provide a concise, professional risk compliance audit.

      Account Data:
      ${JSON.stringify(accountData, null, 2)}

      Generate a clean structured report in Markdown.
      Structure:
      1. **Account Summary**: Key assets, net value estimation, and general status.
      2. **Safety Warnings & Blocking Factors**: Highlight any issues that block a merge (e.g., active sponsorships, high threshold configurations requiring multisig, open trustlines, remaining non-XLM balances).
      3. **DeFi Clean-up Guide**: Specific suggestions for Soroban DeFi, DEX Offers, and AMM pools found in the data.
      4. **Demolition Execution Advice**: Recommended safety steps prior to merge. Recommend using a temporary mediator account if merging towards centralized exchanges.

      Keep the tone highly professional, objective, security-focused, and direct. Avoid any promotional text or fluff. Use formatting for high readability.
    `

    const { text } = await generateText({
      model: "google/gemini-3-flash",
      prompt,
    })

    return NextResponse.json({ result: text })
  } catch (error: any) {
    console.error("[v0] AI audit error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to generate security audit configuration." },
      { status: 500 },
    )
  }
}
