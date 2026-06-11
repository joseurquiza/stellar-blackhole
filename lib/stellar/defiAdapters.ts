import type { AccountAudit, DefiPosition, NetworkId } from "./types"

/**
 * A DeFi protocol adapter knows how to detect positions for an account and,
 * eventually, how to build the operations to close them. Closing is marked
 * `closeable: false` until an adapter is verified against real funds, so the
 * UI surfaces positions for manual action without ever risking irreversible
 * automated calls that could not be safely tested.
 *
 * NOTE: generic, token-balance-shaped positions (LP shares, vault share
 * tokens, SAC balances) are already discovered keylessly by
 * `discoverAccountPositions()` in soroban.ts. Adapters here are reserved for
 * DEEP, protocol-specific reads that are NOT representable as a token balance
 * — e.g. Blend lending positions stored in the pool contract's per-user
 * storage, which require the protocol's ABI to read.
 */
export interface DefiAdapter {
  protocol: string
  /** Detect positions for the given account on the given network. */
  detect(network: NetworkId, audit: AccountAudit): Promise<DefiPosition[]>
}

/**
 * Registry of deep protocol adapters. Empty until an adapter is verified
 * against real contracts; this never blocks discovery, which runs separately.
 */
const ADAPTERS: DefiAdapter[] = [
  // new BlendAdapter(),   // pool.get_positions(user) — needs verified pool ids
  // new PhoenixAdapter(), // stake/farm positions
]

/** Run every registered deep adapter and aggregate detected positions. */
export async function detectAllDefiPositions(
  network: NetworkId,
  audit: AccountAudit,
): Promise<DefiPosition[]> {
  const all: DefiPosition[] = []
  for (const adapter of ADAPTERS) {
    try {
      const found = await adapter.detect(network, audit)
      all.push(...found)
    } catch {
      // a failing adapter must never block the audit
    }
  }
  return all
}

export function registeredProtocols(): string[] {
  return ADAPTERS.map((a) => a.protocol)
}
