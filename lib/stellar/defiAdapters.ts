import type { AccountAudit, DefiPosition, NetworkId } from "./types"

/**
 * A DeFi protocol adapter knows how to detect positions for an account and,
 * eventually, how to build the operations to close them. Closing is marked
 * `closeable: false` until an adapter is verified against real funds, so the
 * UI surfaces positions for manual action without ever risking irreversible
 * automated calls that could not be safely tested.
 */
export interface DefiAdapter {
  protocol: string
  /** Detect positions for the given account on the given network. */
  detect(network: NetworkId, audit: AccountAudit): Promise<DefiPosition[]>
}

/**
 * Registry of adapters. New protocols (Blend, Aquarius, Soroswap, ...) are
 * added here. Each adapter is responsible for its own contract specifics.
 */
const ADAPTERS: DefiAdapter[] = [
  // new BlendAdapter(),
  // new AquariusAdapter(),
  // new SoroswapAdapter(),
]

/** Run every registered adapter and aggregate detected positions. */
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
