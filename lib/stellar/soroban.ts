import {
  Contract,
  rpc,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  TransactionBuilder,
  BASE_FEE,
  Account,
  Horizon,
} from "@stellar/stellar-sdk"
import { getNetwork } from "./network"
import type { NetworkId, SorobanTokenBalance, SorobanAllowance, DefiPosition } from "./types"

/**
 * Known protocol contract ids by network, used to LABEL discovered positions.
 * These are verified mainnet addresses. Detection works without this map (it
 * just falls back to on-chain name/symbol reads); the registry only adds nice
 * protocol labels. Extend it as new addresses are verified.
 */
type ProtocolEntry = { id: string; name: string; kind: string }

const KNOWN_PROTOCOLS: Record<NetworkId, ProtocolEntry[]> = {
  public: [
    { id: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2", name: "Soroswap", kind: "AMM factory" },
    { id: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH", name: "Soroswap", kind: "AMM router" },
    { id: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK", name: "Aquarius", kind: "AMM router" },
  ],
  testnet: [],
}

export function rpcServer(network: NetworkId): rpc.Server {
  const url = getNetwork(network).sorobanRpcUrl
  return new rpc.Server(url, { allowHttp: url.startsWith("http://") })
}

function horizonServer(network: NetworkId): Horizon.Server {
  return new Horizon.Server(getNetwork(network).horizonUrl)
}

/** Label a contract id against the known-protocol registry (best effort). */
export function labelContract(network: NetworkId, contractId: string): ProtocolEntry | null {
  return KNOWN_PROTOCOLS[network].find((p) => p.id === contractId) ?? null
}

/**
 * Discover every Soroban contract an account has interacted with by scanning
 * its `invoke_host_function` operation history on Horizon. This is the keyless,
 * free replacement for an external indexer (OctoPos/Orion): Horizon is public,
 * already a dependency, and retains full history. We extract contract addresses
 * from both the invocation parameters (ScVal addresses) and the SAC
 * `asset_balance_changes` (from/to contract accounts).
 */
export async function discoverInvokedContracts(
  network: NetworkId,
  account: string,
  opts: { maxPages?: number; pageSize?: number } = {},
): Promise<string[]> {
  const maxPages = opts.maxPages ?? 4
  const pageSize = opts.pageSize ?? 200
  const found = new Set<string>()

  try {
    const server = horizonServer(network)
    let page = await server.operations().forAccount(account).limit(pageSize).order("desc").call()

    for (let i = 0; i < maxPages && page.records.length > 0; i++) {
      for (const op of page.records as any[]) {
        if (op.type !== "invoke_host_function") continue

        // 1) contract addresses encoded in the invocation parameters
        for (const param of op.parameters ?? []) {
          const id = contractIdFromScValXdr(param?.value)
          if (id) found.add(id)
        }

        // 2) contract accounts that moved SAC balances in this invocation
        for (const change of op.asset_balance_changes ?? []) {
          for (const addr of [change?.from, change?.to]) {
            if (typeof addr === "string" && addr.startsWith("C") && addr !== account) {
              found.add(addr)
            }
          }
        }
      }

      if (page.records.length < pageSize) break
      page = await page.next()
    }
  } catch {
    // discovery is best effort and must never block the audit
  }

  return [...found]
}

/** Decode a base64 ScVal and return a contract id if it encodes one. */
function contractIdFromScValXdr(base64Value: unknown): string | null {
  if (typeof base64Value !== "string" || base64Value.length === 0) return null
  try {
    const scv = xdr.ScVal.fromXDR(base64Value, "base64")
    const addr = Address.fromScVal(scv).toString()
    return addr.startsWith("C") ? addr : null
  } catch {
    return null
  }
}

/**
 * Read a SAC/Soroban token balance for an account by simulating `balance(addr)`.
 * Also best-effort reads `symbol`, `name`, and `decimals`, and attaches a
 * protocol label when the contract is in the known registry.
 * Returns null when the contract is not a token or the read fails.
 */
export async function readTokenBalance(
  network: NetworkId,
  contractId: string,
  account: string,
): Promise<SorobanTokenBalance | null> {
  try {
    const server = rpcServer(network)
    const contract = new Contract(contractId)
    const passphrase = getNetwork(network).networkPassphrase

    // a dummy source account is fine for read-only simulation
    const source = new Account(account, "0")

    const build = (method: string, ...args: any[]) =>
      new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
        .addOperation(contract.call(method, ...args))
        .setTimeout(30)
        .build()

    const balTx = build("balance", new Address(account).toScVal())
    const balSim = await server.simulateTransaction(balTx)
    if (rpc.Api.isSimulationError(balSim)) return null
    const rawBalance = balSim.result?.retval ? scValToNative(balSim.result.retval).toString() : "0"

    let symbol: string | undefined
    let name: string | undefined
    let decimals: number | undefined
    try {
      const [symSim, nameSim, decSim] = await Promise.all([
        server.simulateTransaction(build("symbol")),
        server.simulateTransaction(build("name")),
        server.simulateTransaction(build("decimals")),
      ])
      if (!rpc.Api.isSimulationError(symSim) && symSim.result?.retval) {
        symbol = scValToNative(symSim.result.retval).toString()
      }
      if (!rpc.Api.isSimulationError(nameSim) && nameSim.result?.retval) {
        name = scValToNative(nameSim.result.retval).toString()
      }
      if (!rpc.Api.isSimulationError(decSim) && decSim.result?.retval) {
        decimals = Number(scValToNative(decSim.result.retval))
      }
    } catch {
      // optional metadata; ignore failures
    }

    if (rawBalance === "0") return null

    const display = decimals != null ? (Number(rawBalance) / 10 ** decimals).toString() : rawBalance
    const label = labelContract(network, contractId)

    return {
      contractId,
      symbol,
      name,
      decimals,
      rawBalance,
      displayBalance: display,
      protocolLabel: label?.name,
    }
  } catch {
    return null
  }
}

/**
 * Detect known DeFi protocol involvement by checking candidate contract ids
 * against the known-protocol registry. Used for labeling; real position
 * closing is delegated to protocol adapters and is preview-only.
 */
export function detectKnownProtocols(network: NetworkId, contractIds: string[]): DefiPosition[] {
  const positions: DefiPosition[] = []
  for (const id of contractIds) {
    const match = labelContract(network, id)
    if (match) {
      positions.push({
        protocol: match.name,
        kind: match.kind,
        summary: `Detected interaction with ${match.name} (${match.kind}). Close this position in the protocol UI before merging.`,
        closeable: false,
      })
    }
  }
  return positions
}

/**
 * Scan a list of candidate contract ids for token balances belonging to the
 * account.
 */
export async function scanSorobanTokens(
  network: NetworkId,
  account: string,
  candidateContractIds: string[],
  concurrency = 5,
): Promise<SorobanTokenBalance[]> {
  const results: SorobanTokenBalance[] = []
  // process in fixed-size batches to keep the audit responsive while bounding
  // the number of simultaneous RPC simulations.
  for (let i = 0; i < candidateContractIds.length; i += concurrency) {
    const batch = candidateContractIds.slice(i, i + concurrency)
    const settled = await Promise.all(batch.map((id) => readTokenBalance(network, id, account)))
    for (const bal of settled) {
      if (bal) results.push(bal)
    }
  }
  return results
}

/**
 * Full keyless discovery: enumerate the contracts an account has touched from
 * Horizon history, then read live token balances/metadata for each via the
 * Soroban RPC. Returns active token balances and labeled DeFi positions.
 * Extra contract ids (e.g. user-pasted) are merged into the candidate set.
 */
export async function discoverAccountPositions(
  network: NetworkId,
  account: string,
  extraContractIds: string[] = [],
): Promise<{ tokens: SorobanTokenBalance[]; positions: DefiPosition[] }> {
  const discovered = await discoverInvokedContracts(network, account)
  // user-pasted ids first (always scanned), then discovered, capped to keep the
  // audit responsive for very active accounts.
  const candidates = [...new Set([...extraContractIds, ...discovered])].slice(0, 40)

  const tokens = await scanSorobanTokens(network, account, candidates)

  // Positions: any held token whose contract is a known protocol, surfaced for
  // manual closing. (Generic token holdings still appear under sorobanTokens.)
  const positions: DefiPosition[] = []
  for (const t of tokens) {
    const label = labelContract(network, t.contractId)
    if (label) {
      positions.push({
        protocol: label.name,
        kind: label.kind,
        summary: `Holding ${t.displayBalance}${t.symbol ? ` ${t.symbol}` : ""} in ${label.name} (${label.kind}). Close this position in the protocol UI before merging.`,
        closeable: false,
      })
    }
  }

  return { tokens, positions }
}

// ---------------------------------------------------------------------------
// Soroban sweep: operation builders + allowance reads (additive; only invoked
// when the Soroban-sweep feature flag is on). These return raw operations that
// the Soroban executor wraps in a transaction and prepares (simulate +
// assemble footprint/fees) before signing.
// ---------------------------------------------------------------------------

/** i128 ScVal from a raw (un-scaled) integer-like string. */
function i128(raw: string): xdr.ScVal {
  return nativeToScVal(BigInt(raw), { type: "i128" })
}

/**
 * Build a token `transfer(from, to, amount)` invocation to move a SAC/Soroban
 * token balance out of the account to the destination before merge.
 */
export function buildTransferOp(
  contractId: string,
  from: string,
  to: string,
  rawAmount: string,
): xdr.Operation {
  const contract = new Contract(contractId)
  return contract.call(
    "transfer",
    new Address(from).toScVal(),
    new Address(to).toScVal(),
    i128(rawAmount),
  )
}

/**
 * Build a token `approve(from, spender, 0, expiration_ledger)` invocation to
 * revoke a dangling allowance. Expiration 0 clears the entry per SEP-41.
 */
export function buildApproveZeroOp(
  contractId: string,
  from: string,
  spender: string,
): xdr.Operation {
  const contract = new Contract(contractId)
  return contract.call(
    "approve",
    new Address(from).toScVal(),
    new Address(spender).toScVal(),
    i128("0"),
    nativeToScVal(0, { type: "u32" }),
  )
}

/**
 * Best-effort read of token allowances the account has granted to a set of
 * candidate spender contracts (e.g. routers/pools it has interacted with).
 * Returns only non-zero allowances. Never throws — allowance reads are
 * advisory and must not block the audit.
 */
export async function readAllowances(
  network: NetworkId,
  account: string,
  tokenContractIds: string[],
  candidateSpenders: string[],
): Promise<SorobanAllowance[]> {
  const out: SorobanAllowance[] = []
  if (tokenContractIds.length === 0 || candidateSpenders.length === 0) return out

  try {
    const server = rpcServer(network)
    const passphrase = getNetwork(network).networkPassphrase
    const source = new Account(account, "0")

    for (const tokenId of tokenContractIds) {
      const contract = new Contract(tokenId)
      let symbol: string | undefined
      try {
        const symTx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
          .addOperation(contract.call("symbol"))
          .setTimeout(30)
          .build()
        const symSim = await server.simulateTransaction(symTx)
        if (!rpc.Api.isSimulationError(symSim) && symSim.result?.retval) {
          symbol = scValToNative(symSim.result.retval).toString()
        }
      } catch {
        // optional
      }

      for (const spender of candidateSpenders) {
        if (spender === account) continue
        try {
          const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
            .addOperation(
              contract.call(
                "allowance",
                new Address(account).toScVal(),
                new Address(spender).toScVal(),
              ),
            )
            .setTimeout(30)
            .build()
          const sim = await server.simulateTransaction(tx)
          if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) continue
          const amount = scValToNative(sim.result.retval).toString()
          if (amount && amount !== "0") {
            out.push({
              contractId: tokenId,
              symbol,
              spender,
              amount,
              spenderLabel: labelContract(network, spender)?.name,
            })
          }
        } catch {
          // ignore individual allowance probe failures
        }
      }
    }
  } catch {
    // best effort
  }

  return out
}
