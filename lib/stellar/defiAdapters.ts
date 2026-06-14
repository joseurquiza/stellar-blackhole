import { Contract, Address, nativeToScVal, xdr } from "@stellar/stellar-sdk"
import type { AccountAudit, DefiPosition, NetworkId, SorobanUnit } from "./types"

/**
 * A DeFi protocol adapter knows how to (a) detect positions for an account and
 * (b) build the Soroban operations to close them and recover value to a
 * destination.
 *
 * SAFETY: a position is only reported `closeable: true` when the adapter can
 * build its exit call with confidence (verified contract id + known method
 * shape). Anything uncertain stays `closeable: false` so the UI surfaces it for
 * manual action and we NEVER emit an unverified irreversible invocation.
 *
 * Generic token-balance-shaped positions (LP share tokens, vault shares, SAC
 * balances) are already discovered keylessly in soroban.ts. Adapters here are
 * reserved for DEEP, protocol-specific reads/writes that are not representable
 * as a plain token balance.
 */
export interface DefiAdapter {
  id: string
  protocol: string
  /** Detect positions for the given account on the given network. */
  detect(network: NetworkId, audit: AccountAudit): Promise<DefiPosition[]>
  /** Build ordered Soroban units that close a detected position. */
  buildCloseUnits(
    network: NetworkId,
    audit: AccountAudit,
    position: DefiPosition,
    destination: string,
  ): Promise<SorobanUnit[]>
}

// Verified mainnet protocol contracts. These IDs gate detection; an empty list
// for a network means that adapter never reports closeable positions there.
const BLEND_POOLS: Record<NetworkId, string[]> = {
  // Blend "Fixed XLM-USDC" / primary pools — extend as verified.
  public: ["CCLBPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLX5B5"],
  testnet: [],
}

const SOROSWAP_ROUTER: Record<NetworkId, string | null> = {
  public: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
  testnet: null,
}

/** Build an adapter-invoke unit; the actual op is constructed by the executor. */
function adapterUnit(
  adapterId: string,
  contractId: string,
  method: string,
  description: string,
  details: string[],
  payload: Record<string, unknown>,
  recoversTo: string,
): SorobanUnit {
  return {
    kind: "soroban-withdraw",
    contractId,
    method,
    description,
    details,
    build: { op: "adapter-invoke", adapterId, payload },
    recoversTo,
  }
}

/**
 * Blend lending adapter. Reads per-user positions from a pool's storage and
 * builds a `submit(from, spender, to, requests)` call whose requests withdraw
 * all supplied collateral back to the destination.
 *
 * Detection requires a verified pool id. Until per-user `get_positions` reads
 * are validated against funded testnet positions, detected pools are reported
 * `closeable: false` (manual) so no unverified withdraw is ever emitted.
 */
const blendAdapter: DefiAdapter = {
  id: "blend",
  protocol: "Blend",
  async detect(network, audit) {
    const pools = BLEND_POOLS[network]
    if (pools.length === 0) return []
    // Surface any Blend pool the account has touched (from discovery labels or
    // contract interaction). Conservative: manual close until verified.
    const touched = new Set<string>([
      ...audit.sorobanTokens.map((t) => t.contractId),
      ...audit.defiPositions.map((p) => p.contractId ?? ""),
    ])
    const positions: DefiPosition[] = []
    for (const pool of pools) {
      if (touched.has(pool)) {
        positions.push({
          protocol: "Blend",
          kind: "Lending position",
          summary:
            "Detected a Blend pool interaction. Withdraw your supplied assets and claim emissions in the Blend UI before merging.",
          closeable: false,
          contractId: pool,
          adapterId: "blend",
        })
      }
    }
    return positions
  },
  async buildCloseUnits(network, audit, position, destination) {
    // Exit call shape: submit(from, spender, to, requests:Vec<Request>) where a
    // Request {request_type: u32, address: Address, amount: i128}. request_type
    // 3 = WithdrawCollateral, 5 = Withdraw (supply). Building the full request
    // vector safely requires a verified per-user position read, so we only emit
    // units when the position was explicitly marked closeable upstream.
    if (!position.closeable || !position.contractId) return []
    const from = audit.publicKey
    const requests = nativeToScVal([], { type: "i128" }) // placeholder; populated when verified
    void requests
    return [
      adapterUnit(
        "blend",
        position.contractId,
        "submit",
        "Withdraw Blend supplied assets to destination",
        [`Pool ${position.contractId.slice(0, 6)}…`, `Recipient ${destination.slice(0, 6)}…`],
        { from, to: destination },
        destination,
      ),
    ]
  },
}

/**
 * Phoenix / Soroswap LP adapter. LP shares are usually a token balance (already
 * swept by the generic token transfer), but redeeming the underlying reserves
 * requires a pair `withdraw_liquidity` / router `remove_liquidity` call.
 */
const phoenixSoroswapAdapter: DefiAdapter = {
  id: "phoenix-soroswap",
  protocol: "Phoenix / Soroswap",
  async detect(network, audit) {
    const router = SOROSWAP_ROUTER[network]
    if (!router) return []
    const positions: DefiPosition[] = []
    // LP share tokens look like token balances; flag ones whose contract was a
    // pair/pool the account interacted with. Manual close until verified.
    for (const t of audit.sorobanTokens) {
      const sym = (t.symbol ?? "").toUpperCase()
      if (sym.includes("LP") || sym.includes("POOL") || sym.includes("PHO")) {
        positions.push({
          protocol: "Phoenix / Soroswap",
          kind: "Liquidity position",
          summary: `Holding ${t.displayBalance}${t.symbol ? ` ${t.symbol}` : ""} LP shares. Remove liquidity in the protocol UI to recover the underlying assets before merging.`,
          closeable: false,
          contractId: t.contractId,
          adapterId: "phoenix-soroswap",
        })
      }
    }
    return positions
  },
  async buildCloseUnits(network, audit, position, destination) {
    if (!position.closeable || !position.contractId) return []
    return [
      adapterUnit(
        "phoenix-soroswap",
        position.contractId,
        "withdraw_liquidity",
        "Remove liquidity and recover underlying assets",
        [`Pair ${position.contractId.slice(0, 6)}…`, `Recipient ${destination.slice(0, 6)}…`],
        { to: destination },
        destination,
      ),
    ]
  },
}

const ADAPTERS: DefiAdapter[] = [blendAdapter, phoenixSoroswapAdapter]

export function getAdapter(id: string): DefiAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id)
}

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

/**
 * Build the close units for every closeable detected position. Positions that
 * an adapter cannot confidently close yield no units (they remain manual).
 */
export async function buildAllCloseUnits(
  network: NetworkId,
  audit: AccountAudit,
  destination: string,
): Promise<SorobanUnit[]> {
  const units: SorobanUnit[] = []
  for (const position of audit.defiPositions) {
    if (!position.closeable || !position.adapterId) continue
    const adapter = getAdapter(position.adapterId)
    if (!adapter) continue
    try {
      units.push(...(await adapter.buildCloseUnits(network, audit, position, destination)))
    } catch {
      // never let a single adapter break the plan
    }
  }
  return units
}

/**
 * Resolve known DeFi spender contracts (routers/pools) to probe for dangling
 * allowances during the audit.
 */
export function knownSpenders(network: NetworkId): string[] {
  const spenders: string[] = []
  const router = SOROSWAP_ROUTER[network]
  if (router) spenders.push(router)
  spenders.push(...BLEND_POOLS[network])
  return spenders
}

export function registeredProtocols(): string[] {
  return ADAPTERS.map((a) => a.protocol)
}
