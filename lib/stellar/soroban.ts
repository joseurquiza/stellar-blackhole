import { Contract, rpc, Address, scValToNative, TransactionBuilder, BASE_FEE, Account } from "@stellar/stellar-sdk"
import { getNetwork } from "./network"
import type { NetworkId, SorobanTokenBalance, DefiPosition } from "./types"

/**
 * Known protocol contract IDs by network, used to label detected positions.
 * This map is intentionally small and extensible: add entries as protocols
 * are verified. Detection is best-effort and never executes anything.
 */
const KNOWN_PROTOCOLS: Record<NetworkId, { id: string; name: string; kind: string }[]> = {
  public: [
    // Examples — extend with verified mainnet contract ids over time.
    // { id: "C...", name: "Blend", kind: "Lending pool" },
    // { id: "C...", name: "Aquarius", kind: "AMM" },
    // { id: "C...", name: "Soroswap", kind: "AMM router" },
  ],
  testnet: [],
}

function rpcServer(network: NetworkId): rpc.Server {
  const url = getNetwork(network).sorobanRpcUrl
  return new rpc.Server(url, { allowHttp: url.startsWith("http://") })
}

/**
 * Read a SAC/Soroban token balance for an account by simulating `balance(addr)`.
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
    let decimals: number | undefined
    try {
      const symSim = await server.simulateTransaction(build("symbol"))
      if (!rpc.Api.isSimulationError(symSim) && symSim.result?.retval) {
        symbol = scValToNative(symSim.result.retval).toString()
      }
      const decSim = await server.simulateTransaction(build("decimals"))
      if (!rpc.Api.isSimulationError(decSim) && decSim.result?.retval) {
        decimals = Number(scValToNative(decSim.result.retval))
      }
    } catch {
      // optional metadata; ignore failures
    }

    if (rawBalance === "0") return null

    const display =
      decimals != null ? (Number(rawBalance) / 10 ** decimals).toString() : rawBalance

    return { contractId, symbol, decimals, rawBalance, displayBalance: display }
  } catch {
    return null
  }
}

/**
 * Detect known DeFi protocol involvement by checking the candidate contract
 * ids against the known-protocol registry. Real position-closing is delegated
 * to protocol adapters (defiAdapters.ts) and is preview-only in this phase.
 */
export function detectKnownProtocols(network: NetworkId, contractIds: string[]): DefiPosition[] {
  const known = KNOWN_PROTOCOLS[network]
  const positions: DefiPosition[] = []
  for (const id of contractIds) {
    const match = known.find((k) => k.id === id)
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
 * account. Candidate ids typically come from the user (paste) or a future
 * indexer integration; Horizon does not enumerate Soroban token holdings.
 */
export async function scanSorobanTokens(
  network: NetworkId,
  account: string,
  candidateContractIds: string[],
): Promise<SorobanTokenBalance[]> {
  const results: SorobanTokenBalance[] = []
  for (const id of candidateContractIds) {
    const bal = await readTokenBalance(network, id, account)
    if (bal) results.push(bal)
  }
  return results
}
