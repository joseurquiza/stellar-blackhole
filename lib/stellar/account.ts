import { Horizon } from "@stellar/stellar-sdk"
import { getNetwork, makeAssetId, NATIVE_ASSET } from "./network"
import { discoverAccountPositions, readAllowances } from "./soroban"
import { detectAllDefiPositions, knownSpenders } from "./defiAdapters"
import { SOROBAN_SWEEP_ENABLED } from "./flags"
import type {
  AccountAudit,
  BalanceLine,
  ClaimableBalance,
  DataEntry,
  LiquidityPoolStake,
  NetworkId,
  OpenOffer,
  SignerInfo,
  SorobanAllowance,
} from "./types"

const BASE_RESERVE = 0.5

function horizon(network: NetworkId): Horizon.Server {
  return new Horizon.Server(getNetwork(network).horizonUrl)
}

/**
 * Summarize a claimable balance predicate into a human readable string and
 * a best-effort "claimable right now" boolean for the given claimant.
 */
function summarizePredicate(
  predicate: Horizon.HorizonApi.Predicate | undefined,
): { summary: string; claimableNow: boolean } {
  const isUnconditional = (p: Horizon.HorizonApi.Predicate): boolean =>
    !p.and && !p.or && !p.not && !p.abs_before && !p.rel_before

  if (!predicate) return { summary: "Unconditional", claimableNow: true }
  if (isUnconditional(predicate)) return { summary: "Unconditional", claimableNow: true }

  const now = Math.floor(Date.now() / 1000)

  const evaluate = (p: Horizon.HorizonApi.Predicate): boolean => {
    if (isUnconditional(p)) return true
    if (p.abs_before) {
      const t = Math.floor(new Date(p.abs_before).getTime() / 1000)
      return now < t
    }
    if (p.rel_before) {
      // relative predicates depend on the balance creation ledger close time,
      // which Horizon does not expose here; treat as claimable best-effort.
      return true
    }
    if (p.and) return p.and.every(evaluate)
    if (p.or) return p.or.some(evaluate)
    if (p.not) return !evaluate(p.not)
    return true
  }

  const describe = (p: Horizon.HorizonApi.Predicate): string => {
    if (isUnconditional(p)) return "unconditional"
    if (p.abs_before) return `before ${new Date(p.abs_before).toISOString()}`
    if (p.rel_before) return `within ${p.rel_before}s of creation`
    if (p.and) return `(${p.and.map(describe).join(" AND ")})`
    if (p.or) return `(${p.or.map(describe).join(" OR ")})`
    if (p.not) return `NOT ${describe(p.not)}`
    return "unknown"
  }

  return { summary: describe(predicate), claimableNow: evaluate(predicate) }
}

/**
 * Loads and audits the full classic state of a Stellar account from Horizon.
 * Soroban token/allowance/DeFi detection is layered in separately (soroban.ts)
 * and merged by the caller; here we return empty arrays for those fields.
 */
export async function loadAccountAudit(publicKey: string, network: NetworkId): Promise<AccountAudit> {
  const server = horizon(network)

  let account: Horizon.AccountResponse
  try {
    account = await server.loadAccount(publicKey)
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.name === "NotFoundError") {
      return emptyAudit(publicKey, network)
    }
    throw err
  }

  const balances: BalanceLine[] = []
  const liquidityPools: LiquidityPoolStake[] = []
  let nativeBalance = "0"

  for (const line of account.balances) {
    if (line.asset_type === "native") {
      nativeBalance = line.balance
      balances.push({
        asset: NATIVE_ASSET,
        balance: line.balance,
        sellingLiabilities: line.selling_liabilities ?? "0",
        buyingLiabilities: line.buying_liabilities ?? "0",
        isDust: Number.parseFloat(line.balance) < 0.5,
      })
    } else if (line.asset_type === "liquidity_pool_shares") {
      liquidityPools.push({
        poolId: (line as any).liquidity_pool_id,
        shares: line.balance,
        reserves: [],
        sponsor: (line as any).sponsor,
      })
    } else {
      const assetLine = line as Horizon.HorizonApi.BalanceLineAsset
      balances.push({
        asset: makeAssetId(assetLine.asset_code, assetLine.asset_issuer),
        balance: assetLine.balance,
        limit: assetLine.limit,
        authorized: assetLine.is_authorized ?? true,
        sellingLiabilities: assetLine.selling_liabilities ?? "0",
        buyingLiabilities: assetLine.buying_liabilities ?? "0",
        isDust: Number.parseFloat(assetLine.balance) === 0,
        sponsor: (assetLine as any).sponsor,
      })
    }
  }

  const signers: SignerInfo[] = account.signers.map((s) => ({
    key: s.key,
    weight: s.weight,
    type: s.type,
    sponsor: (s as any).sponsor,
  }))

  const dataEntries: DataEntry[] = Object.entries(account.data_attr ?? {}).map(([name, value]) => ({
    name,
    value: value as string,
  }))

  // Open offers (paginated; first 200 is plenty for cleanup purposes)
  const offerRecords = await server.offers().forAccount(publicKey).limit(200).call()
  const openOffers: OpenOffer[] = offerRecords.records.map((o) => ({
    id: String(o.id),
    selling:
      o.selling.asset_type === "native"
        ? NATIVE_ASSET
        : makeAssetId((o.selling as any).asset_code, (o.selling as any).asset_issuer),
    buying:
      o.buying.asset_type === "native"
        ? NATIVE_ASSET
        : makeAssetId((o.buying as any).asset_code, (o.buying as any).asset_issuer),
    amount: o.amount,
    price: o.price,
    sponsor: (o as any).sponsor,
  }))

  // Claimable balances where this account is a claimant
  const cbRecords = await server.claimableBalances().claimant(publicKey).limit(100).call()
  const claimableBalances: ClaimableBalance[] = cbRecords.records.map((cb) => {
    const mine = cb.claimants.find((c) => c.destination === publicKey)
    const { summary, claimableNow } = summarizePredicate(mine?.predicate)
    return {
      id: cb.id,
      asset:
        cb.asset === "native"
          ? NATIVE_ASSET
          : makeAssetId(cb.asset.split(":")[0], cb.asset.split(":")[1]),
      amount: cb.amount,
      claimableNow,
      predicateSummary: summary,
    }
  })

  const subentryCount = account.subentry_count
  const numSponsoring = (account as any).num_sponsoring ?? 0
  const numSponsored = (account as any).num_sponsored ?? 0
  const minBalance = (2 + subentryCount + numSponsoring - numSponsored) * BASE_RESERVE

  const masterSigner = account.signers.find((s) => s.key === publicKey)
  const masterWeight = masterSigner?.weight ?? 0
  const isMultisig =
    account.signers.filter((s) => s.weight > 0).length > 1 ||
    account.thresholds.high_threshold > masterWeight

  const sorobanAllowances: SorobanAllowance[] = []

  const audit: AccountAudit = {
    publicKey,
    network,
    exists: true,
    nativeBalance,
    minBalance: minBalance.toFixed(7),
    baseReserve: BASE_RESERVE.toFixed(1),
    subentryCount,
    balances,
    liquidityPools,
    openOffers,
    dataEntries,
    signers,
    thresholds: {
      low: account.thresholds.low_threshold,
      med: account.thresholds.med_threshold,
      high: account.thresholds.high_threshold,
      masterWeight,
    },
    sponsorship: { numSponsoring, numSponsored },
    claimableBalances,
    sorobanTokens: [],
    sorobanAllowances,
    defiPositions: [],
    isMultisig,
    hasMasterKeyDisabled: masterWeight === 0,
  }

  // Keyless Soroban discovery: enumerate contracts the account has touched via
  // Horizon history, then read live balances/labels via the public RPC. This
  // is best-effort and must never block the classic audit, so failures are
  // swallowed and leave the arrays empty.
  try {
    const { tokens, positions } = await discoverAccountPositions(network, publicKey)
    audit.sorobanTokens = tokens
    const adapterPositions = await detectAllDefiPositions(network, audit)
    audit.defiPositions = [...positions, ...adapterPositions]

    // Allowance probing only runs with the Soroban-sweep feature flag on, so
    // classic users incur zero extra RPC calls and behavior is unchanged.
    if (SOROBAN_SWEEP_ENABLED && tokens.length > 0) {
      audit.sorobanAllowances = await readAllowances(
        network,
        publicKey,
        tokens.map((t) => t.contractId),
        knownSpenders(network),
      )
    }
  } catch {
    // discovery failed; classic audit remains fully valid
  }

  return audit
}

function emptyAudit(publicKey: string, network: NetworkId): AccountAudit {
  return {
    publicKey,
    network,
    exists: false,
    nativeBalance: "0",
    minBalance: "0",
    baseReserve: BASE_RESERVE.toFixed(1),
    subentryCount: 0,
    balances: [],
    liquidityPools: [],
    openOffers: [],
    dataEntries: [],
    signers: [],
    thresholds: { low: 0, med: 0, high: 0, masterWeight: 0 },
    sponsorship: { numSponsoring: 0, numSponsored: 0 },
    claimableBalances: [],
    sorobanTokens: [],
    sorobanAllowances: [],
    defiPositions: [],
    isMultisig: false,
    hasMasterKeyDisabled: false,
  }
}

/** Validates a Stellar public key (G...) using StrKey. */
export { horizon as getHorizonServer }
