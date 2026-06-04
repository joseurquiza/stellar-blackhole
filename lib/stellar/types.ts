// Core domain types for the Stellar account demolisher engine.
// These describe the audited state of an account and the planned operations.

export type NetworkId = "public" | "testnet"

export interface NetworkConfig {
  id: NetworkId
  label: string
  horizonUrl: string
  sorobanRpcUrl: string
  networkPassphrase: string
  explorerBase: string
}

export interface AssetId {
  // "native" for XLM, otherwise CODE:ISSUER
  code: string
  issuer?: string
  isNative: boolean
  // canonical key used for maps/lookups
  key: string
}

export interface BalanceLine {
  asset: AssetId
  balance: string
  // for non-native: trustline limit + whether it is authorized
  limit?: string
  authorized?: boolean
  // selling/buying liabilities currently locked by open offers
  sellingLiabilities: string
  buyingLiabilities: string
  // true when balance + reserve considerations make this dust-only
  isDust: boolean
  // sponsorship of the trustline entry, if any
  sponsor?: string
}

export interface LiquidityPoolStake {
  poolId: string
  shares: string
  // reserves the pool holds, for display
  reserves: { asset: AssetId; amount: string }[]
  sponsor?: string
}

export interface OpenOffer {
  id: string
  selling: AssetId
  buying: AssetId
  amount: string
  price: string
  sponsor?: string
}

export interface DataEntry {
  name: string
  value: string
  sponsor?: string
}

export interface SignerInfo {
  key: string
  weight: number
  type: string
  sponsor?: string
}

export interface ClaimableBalance {
  id: string
  asset: AssetId
  amount: string
  // whether the current account can claim it right now
  claimableNow: boolean
  // human readable predicate summary
  predicateSummary: string
}

export interface Thresholds {
  low: number
  med: number
  high: number
  masterWeight: number
}

export interface SponsorshipInfo {
  // entries this account sponsors FOR OTHERS (hard block on merge)
  numSponsoring: number
  // entries sponsored by others ON BEHALF of this account
  numSponsored: number
}

export interface SorobanTokenBalance {
  contractId: string
  symbol?: string
  decimals?: number
  rawBalance: string
  displayBalance: string
}

export interface SorobanAllowance {
  contractId: string
  symbol?: string
  spender: string
  amount: string
  // best-effort label for the spender (e.g. known protocol)
  spenderLabel?: string
}

export interface DefiPosition {
  protocol: string
  kind: string
  summary: string
  // detection only in this phase; closing handled by adapters later
  closeable: boolean
}

export interface AccountAudit {
  publicKey: string
  network: NetworkId
  exists: boolean
  // raw XLM balance available
  nativeBalance: string
  // minimum balance required by current subentries (in XLM)
  minBalance: string
  // base reserve per entry, network param
  baseReserve: string
  subentryCount: number
  balances: BalanceLine[]
  liquidityPools: LiquidityPoolStake[]
  openOffers: OpenOffer[]
  dataEntries: DataEntry[]
  signers: SignerInfo[]
  thresholds: Thresholds
  sponsorship: SponsorshipInfo
  claimableBalances: ClaimableBalance[]
  sorobanTokens: SorobanTokenBalance[]
  sorobanAllowances: SorobanAllowance[]
  defiPositions: DefiPosition[]
  // computed flags
  isMultisig: boolean
  hasMasterKeyDisabled: boolean
}

// ---- Planning ----

export type StepKind =
  | "sell-asset"
  | "withdraw-pool"
  | "remove-offer"
  | "claim-balance"
  | "remove-trustline"
  | "remove-data"
  | "reconfigure-signers"
  | "mediator-payment"
  | "account-merge"

export interface PlannedOperation {
  kind: StepKind
  // human readable description shown in dry-run + execution
  description: string
  // detail lines for the UI
  details: string[]
  // estimated XLM reserve reclaimed by this op (0 if none)
  reserveReclaimed: number
  // whether this op is irreversible / destructive
  destructive: boolean
}

export interface PlannedTransaction {
  // a single Stellar transaction (<= 100 ops); we keep ops grouped logically
  label: string
  operations: PlannedOperation[]
  // requires extra signatures beyond the source (multisig)
  requiresAdditionalSignatures: boolean
}

export interface DemolitionPlan {
  publicKey: string
  network: NetworkId
  transactions: PlannedTransaction[]
  // total XLM expected to be recovered at the destination after merge
  estimatedRecoveredXlm: string
  // hard blocks that must be resolved before any execution
  blockers: PlanBlocker[]
  // non-fatal warnings
  warnings: string[]
  // resolved configuration used to build this plan
  config: DemolitionConfig
}

export interface PlanBlocker {
  code: string
  title: string
  detail: string
}

export interface DemolitionConfig {
  publicKey: string
  network: NetworkId
  // where remaining XLM ends up
  destinationAddress: string
  // route through an intermediary payment before merge (for exchanges)
  useMediator: boolean
  mediatorAddress?: string
  mediatorMemo?: string
  // sell non-XLM balances to this base asset before merge
  sellToBase: boolean
  baseAsset: AssetId
  // max slippage tolerance in basis points for path payments
  slippageBps: number
  // claim available claimable balances
  claimBalances: boolean
  // withdraw from liquidity pools
  withdrawPools: boolean
}

// ---- Execution ----

export type StepStatus = "pending" | "signing" | "submitting" | "success" | "failed" | "skipped"

export interface ExecutionStep {
  id: string
  label: string
  status: StepStatus
  txHash?: string
  error?: string
}
